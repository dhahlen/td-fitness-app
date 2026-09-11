import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../src/index";
import type { Intake } from "../src/types";
import { beginnerFatLoss } from "./fixtures";

const COACH = { authorization: `Bearer ${env.COACH_API_KEY}` };

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.fetch(
    new Request(`https://test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    env,
  );
}

const get = (path: string, headers: Record<string, string> = {}) =>
  app.fetch(new Request(`https://test${path}`, { headers }), env);

const withEmail = (base: Intake, email: string): Intake =>
  ({ ...base, client: { ...base.client, email } });

const count = async (sql: string, ...binds: unknown[]) => {
  const row = await env.DB.prepare(sql).bind(...binds).first<{ n: number }>();
  return row?.n ?? 0;
};

describe("POST /api/intake", () => {
  it("persists a client, an intake, a program, and its flags", async () => {
    const res = await post("/api/intake", withEmail(beginnerFatLoss, "persist@test.com"));
    expect(res.status).toBe(201);
    const body = await res.json<{ clientId: string; programId: string; status: string }>();
    expect(body.status).toBe("active");

    expect(await count("SELECT COUNT(*) n FROM clients WHERE id=?", body.clientId)).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM intakes WHERE client_id=?", body.clientId)).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM programs WHERE id=? AND is_active=1", body.programId)).toBe(1);
  });

  it("rejects a payload that fails validation", async () => {
    const res = await post("/api/intake", { client: {} });
    expect(res.status).toBe(400);
    expect((await res.json<{ error: string }>()).error).toBe("invalid_intake");
  });

  it("keeps one client and one active program across a re-intake", async () => {
    const intake = withEmail(beginnerFatLoss, "again@test.com");
    const first = await (await post("/api/intake", intake)).json<{ clientId: string }>();

    const second = await post("/api/intake", { ...intake, goals: { ...intake.goals, primary: "strength" } });
    expect(second.status).toBe(201);
    const body = await second.json<{ clientId: string }>();

    expect(body.clientId).toBe(first.clientId);
    expect(await count("SELECT COUNT(*) n FROM clients WHERE email=?", "again@test.com")).toBe(1);
    // History of what drove each program survives: a new intake row, not an edit.
    expect(await count("SELECT COUNT(*) n FROM intakes WHERE client_id=?", body.clientId)).toBe(2);
    expect(await count("SELECT COUNT(*) n FROM programs WHERE client_id=?", body.clientId)).toBe(2);
    expect(await count("SELECT COUNT(*) n FROM programs WHERE client_id=? AND is_active=1", body.clientId)).toBe(1);
  });
});

describe("safety routing", () => {
  it("archives a minor and stores no program to start", async () => {
    const minor = withEmail(beginnerFatLoss, "minor@test.com");
    minor.client = { ...minor.client, dob: "2012-01-01" };
    const body = await (await post("/api/intake", minor)).json<{
      status: string; clientId: string; program: { split: unknown; nutrition: unknown };
    }>();

    expect(body.status).toBe("archived");
    expect(body.program.split).toBeNull();
    expect(body.program.nutrition).toBeNull();
    expect(await count("SELECT COUNT(*) n FROM programs WHERE client_id=? AND is_active=1", body.clientId)).toBe(0);
  });

  it("holds an eating disorder screen for the coach and still issues training", async () => {
    const ed = withEmail(beginnerFatLoss, "ed@test.com");
    ed.screening = { ...ed.screening, eatingDisorderHistory: true };
    const body = await (await post("/api/intake", ed)).json<{
      status: string; clientId: string; program: { split: unknown; nutrition: unknown };
    }>();

    expect(body.status).toBe("manual_review");
    expect(body.program.nutrition).toBeNull();
    expect(body.program.split).not.toBeNull();
    // A held program must not go active on its own.
    expect(await count("SELECT COUNT(*) n FROM programs WHERE client_id=? AND is_active=1", body.clientId)).toBe(0);
  });

  it("holds a program that lands on the absolute calorie floor", async () => {
    const small = withEmail(beginnerFatLoss, "floor@test.com");
    small.client = { ...small.client, sex: "female" };
    small.metrics = { heightCm: 150, weightKg: 45, bodyFatPct: 35, bodyFatMethod: "bia" };
    small.activity = { job: "desk_seated", steps: "under_5k", cardioSessions: 0 };

    const body = await (await post("/api/intake", small)).json<{
      status: string; clientId: string;
      program: { nutrition: { floorApplied: boolean; floorType: string | null } };
    }>();

    expect(body.program.nutrition.floorApplied).toBe(true);
    expect(body.program.nutrition.floorType).toBe("absolute");
    expect(body.status).toBe("manual_review");
    expect(await count("SELECT COUNT(*) n FROM programs WHERE client_id=? AND is_active=1", body.clientId)).toBe(0);
  });

  it("requires clearance when a PAR-Q answer is positive", async () => {
    const flagged = withEmail(beginnerFatLoss, "parq@test.com");
    flagged.screening = { ...flagged.screening, parq: [true, false, false, false, false, false, false] };
    const body = await (await post("/api/intake", flagged)).json<{ status: string; clientId: string }>();

    expect(body.status).toBe("pending_clearance");
    expect(await count(
      "SELECT COUNT(*) n FROM safety_flags WHERE client_id=? AND code='parq_positive'", body.clientId,
    )).toBe(1);
  });
});

describe("POST /api/program/preview", () => {
  it("returns a program without writing anything", async () => {
    const before = await count("SELECT COUNT(*) n FROM clients");
    const res = await post("/api/program/preview", withEmail(beginnerFatLoss, "preview@test.com"));
    expect(res.status).toBe(200);
    expect((await res.json<{ level: { level: string } }>()).level.level).toBe("beginner");
    expect(await count("SELECT COUNT(*) n FROM clients")).toBe(before);
  });
});

describe("coach endpoints", () => {
  it("refuses a request without the coach key", async () => {
    expect((await get("/api/coach/queue")).status).toBe(401);
    expect((await get("/api/coach/queue", { authorization: "Bearer wrong" })).status).toBe(401);
  });

  it("lists clients waiting on the coach", async () => {
    const ed = withEmail(beginnerFatLoss, "queue@test.com");
    ed.screening = { ...ed.screening, eatingDisorderHistory: true };
    await post("/api/intake", ed);

    const { clients } = await (await get("/api/coach/queue", COACH)).json<{
      clients: Array<{ email: string; status: string; open_flags: number }>;
    }>();
    const row = clients.find((x) => x.email === "queue@test.com");
    expect(row?.status).toBe("manual_review");
    expect(row?.open_flags).toBeGreaterThan(0);
  });

  it("returns the client record with the program output parsed", async () => {
    const body = await (await post("/api/intake", withEmail(beginnerFatLoss, "detail@test.com")))
      .json<{ clientId: string }>();

    const res = await get(`/api/coach/client/${body.clientId}`, COACH);
    expect(res.status).toBe(200);
    const detail = await res.json<{ program: { output: { level: { level: string } } }; flags: unknown[] }>();
    expect(detail.program.output.level.level).toBe("beginner");
  });

  it("404s on an unknown client", async () => {
    expect((await get("/api/coach/client/nope", COACH)).status).toBe(404);
  });

  it("approving a program retires the client's other programs", async () => {
    const intake = withEmail(beginnerFatLoss, "approve@test.com");
    const first = await (await post("/api/intake", intake)).json<{ clientId: string; programId: string }>();
    await post("/api/intake", intake); // supersedes the first

    const res = await post(`/api/coach/program/${first.programId}/approve`, { notes: "start light" }, COACH);
    expect(res.status).toBe(200);

    const active = await env.DB.prepare(
      "SELECT id, coach_approved FROM programs WHERE client_id=? AND is_active=1",
    ).bind(first.clientId).all<{ id: string; coach_approved: number }>();

    expect(active.results).toHaveLength(1);
    expect(active.results[0]?.id).toBe(first.programId);
    expect(active.results[0]?.coach_approved).toBe(1);
  });

  it("404s when approving a program that does not exist", async () => {
    expect((await post("/api/coach/program/nope/approve", {}, COACH)).status).toBe(404);
  });

  it("resolves a flag", async () => {
    const body = await (await post("/api/intake", withEmail(beginnerFatLoss, "flag@test.com")))
      .json<{ clientId: string }>();
    const parq = withEmail(beginnerFatLoss, "flag@test.com");
    parq.screening = { ...parq.screening, parq: [true, false, false, false, false, false, false] };
    await post("/api/intake", parq);

    const flag = await env.DB.prepare("SELECT id FROM safety_flags WHERE client_id=? LIMIT 1")
      .bind(body.clientId).first<{ id: number }>();

    const res = await post(`/api/coach/flag/${flag!.id}/resolve`, { by: "darren" }, COACH);
    expect(res.status).toBe(200);
    expect(await count(
      "SELECT COUNT(*) n FROM safety_flags WHERE id=? AND resolved_at IS NOT NULL", flag!.id,
    )).toBe(1);
  });
});

describe("GET /api/health", () => {
  it("reports the engine version", async () => {
    const body = await (await get("/api/health")).json<{ ok: boolean; engine: string }>();
    expect(body.ok).toBe(true);
    expect(body.engine).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
