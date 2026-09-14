import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateProgram, ENGINE_VERSION, MAX_RECENCY, PARQ_QUESTIONS } from "./engine";
import { IntakeSchema } from "./validation";
import { sendIntakeReceipt } from "./email";
import type { Intake, Program } from "./types";

type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  COACH_API_KEY: string;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  INTAKE_FROM_EMAIL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use("/api/*", cors());

const uuid = () => crypto.randomUUID();

/**
 * How long a part-finished intake is kept. It holds personal data before the
 * client has committed to anything, so it does not live indefinitely.
 */
const DRAFT_TTL_DAYS = 30;

type ClientStatus = "archived" | "manual_review" | "pending_clearance" | "active";

/**
 * Routing status for a generated program. Reads the engine's safety result,
 * never widens or relaxes it.
 *
 * Hitting the absolute calorie floor routes to the coach rather than being
 * served automatically. See docs/program-engine-spec.md section 9.3.
 */
function routingStatus(program: Program): ClientStatus {
  if (program.safety.blocked) return "archived";
  if (program.safety.manualReview || program.nutrition?.floorType === "absolute") {
    return "manual_review";
  }
  if (program.safety.clearanceRequired) return "pending_clearance";
  return "active";
}

/* ---------------- public ---------------- */

app.get("/api/health", (c) => c.json({ ok: true, engine: ENGINE_VERSION }));

/**
 * Field guidance the form renders rather than hardcodes. Product voice, not
 * the coach's, since it explains how the intake behaves.
 */
const GUIDANCE = {
  maxes:
    `Leave these blank and we will establish your working weights in your first sessions. ` +
    `Max numbers are worth giving if you are advanced or competing. If you are newer than that, ` +
    `only fill them in if you tested in the last ${MAX_RECENCY.loadPrescriptionWeeks} weeks. ` +
    `An out of date number sets every load off it, and a weight that is wrong from the start is ` +
    `worse than one we find together.`,
  maxesTestedWithin:
    `Anything older than ${MAX_RECENCY.loadPrescriptionWeeks} weeks still tells us about your ` +
    `training level. It does not set your starting weights.`,
} as const;

app.get("/api/intake/schema", (c) =>
  c.json({ parq: PARQ_QUESTIONS, engineVersion: ENGINE_VERSION, guidance: GUIDANCE }),
);

/**
 * Submit an intake. Generates the program synchronously and persists both.
 * Returns the program, minus nutrition when safety suppressed it.
 */
app.post("/api/intake", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = IntakeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid_intake", issues: parsed.error.issues }, 400);
  }
  const intake = parsed.data as Intake;
  const program = generateProgram(intake);

  // Re-intake keeps the existing client row and its id, so the new intake and
  // program hang off the same client instead of orphaning themselves.
  const existing = await c.env.DB.prepare(`SELECT id FROM clients WHERE email=?`)
    .bind(intake.client.email)
    .first<{ id: string }>();

  const clientId = existing?.id ?? uuid();
  const intakeId = uuid();
  const programId = uuid();

  const status = routingStatus(program);
  const isActive = status === "active" ? 1 : 0;

  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO clients (id,name,email,phone,dob,sex,timezone,status)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(email) DO UPDATE SET
         name=excluded.name, phone=excluded.phone, dob=excluded.dob,
         sex=excluded.sex, timezone=excluded.timezone, status=excluded.status,
         updated_at=datetime('now')`,
    ).bind(
      clientId, intake.client.name, intake.client.email, intake.client.phone ?? null,
      intake.client.dob, intake.client.sex, intake.client.timezone ?? null, status,
    ),
    // A new intake supersedes the last program. One active program per client
    // is enforced by idx_programs_active, so stand the old one down first.
    c.env.DB.prepare(`UPDATE programs SET is_active=0 WHERE client_id=?`).bind(clientId),
    c.env.DB.prepare(`INSERT INTO intakes (id,client_id,payload) VALUES (?,?,?)`)
      .bind(intakeId, clientId, JSON.stringify(intake)),
    c.env.DB.prepare(
      `INSERT INTO programs (id,client_id,intake_id,engine_version,level,level_score,goal,days_per_week,block_weeks,output,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      programId, clientId, intakeId, ENGINE_VERSION, program.level.level, program.level.score,
      intake.goals.primary, intake.schedule.daysPerWeek, intake.goals.blockWeeks,
      JSON.stringify(program), isActive,
    ),
    ...program.safety.flags.map((f) =>
      c.env.DB.prepare(
        `INSERT INTO safety_flags (client_id,program_id,code,severity,message) VALUES (?,?,?,?,?)`,
      ).bind(clientId, programId, f.code, f.severity, f.message),
    ),
  ];

  await c.env.DB.batch(stmts);

  // Retire the draft this came from so the resume link stops working.
  const draft = c.req.query("draft");
  if (draft) {
    await c.env.DB.prepare(`UPDATE drafts SET submitted_at=datetime('now') WHERE token=?`)
      .bind(draft).run();
  }

  // The receipt must not hold up the response, and a mail failure must not
  // fail an intake that is already saved.
  const receipt = sendIntakeReceipt(c.env, intake.client, status).catch(() => undefined);
  try {
    c.executionCtx.waitUntil(receipt);
  } catch {
    // Reading executionCtx throws when the worker was invoked without one.
    // The receipt still runs, it just is not kept alive past the response.
  }

  return c.json({ clientId, programId, status, program }, 201);
});

/** Preview without persisting. Used by the form for live calculation. */
app.post("/api/program/preview", async (c) => {
  const parsed = IntakeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_intake", issues: parsed.error.issues }, 400);
  return c.json(generateProgram(parsed.data as Intake));
});

/* ---------------- drafts ---------------- */

/**
 * Save and resume. The token goes in the URL so the client can finish on a
 * different device, which localStorage cannot do.
 */
app.post("/api/draft", async (c) => {
  const body = await c.req.json<{ payload?: unknown; step?: number }>().catch(() => null);
  if (!body || typeof body.payload !== "object" || body.payload === null) {
    return c.json({ error: "invalid_draft", message: "Send a payload object." }, 400);
  }
  const token = uuid();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM drafts WHERE submitted_at IS NULL AND updated_at < datetime('now', ?)`,
    ).bind(`-${DRAFT_TTL_DAYS} days`),
    c.env.DB.prepare(`INSERT INTO drafts (token,payload,step) VALUES (?,?,?)`)
      .bind(token, JSON.stringify(body.payload), body.step ?? 0),
  ]);
  return c.json({ token }, 201);
});

app.get("/api/draft/:token", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT payload, step, updated_at FROM drafts
     WHERE token=? AND updated_at >= datetime('now', ?)`,
  ).bind(c.req.param("token"), `-${DRAFT_TTL_DAYS} days`).first<{ payload: string; step: number; updated_at: string }>();

  if (!row) {
    return c.json({
      error: "not_found",
      message: `That link has expired. Drafts are kept for ${DRAFT_TTL_DAYS} days. Start again and we will not ask you to repeat anything you have already sent us.`,
    }, 404);
  }
  return c.json({ payload: JSON.parse(row.payload), step: row.step, updatedAt: row.updated_at });
});

app.put("/api/draft/:token", async (c) => {
  const body = await c.req.json<{ payload?: unknown; step?: number }>().catch(() => null);
  if (!body || typeof body.payload !== "object" || body.payload === null) {
    return c.json({ error: "invalid_draft", message: "Send a payload object." }, 400);
  }
  const res = await c.env.DB.prepare(
    `UPDATE drafts SET payload=?, step=?, updated_at=datetime('now')
     WHERE token=? AND submitted_at IS NULL`,
  ).bind(JSON.stringify(body.payload), body.step ?? 0, c.req.param("token")).run();

  if (!res.meta.changes) return c.json({ error: "not_found" }, 404);
  return c.json({ ok: true });
});

/* ---------------- coach ---------------- */

app.use("/api/coach/*", async (c, next) => {
  const key = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!key || key !== c.env.COACH_API_KEY) return c.json({ error: "unauthorized" }, 401);
  await next();
});

app.get("/api/coach/queue", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.email, c.status, p.level, p.goal, p.created_at,
            (SELECT COUNT(*) FROM safety_flags f WHERE f.client_id=c.id AND f.resolved_at IS NULL) AS open_flags
     FROM clients c
     LEFT JOIN programs p ON p.client_id=c.id AND p.is_active=1
     WHERE c.status IN ('pending_clearance','manual_review','intake')
     ORDER BY c.created_at DESC`,
  ).all();
  return c.json({ clients: results });
});

app.get("/api/coach/client/:id", async (c) => {
  const id = c.req.param("id");
  const client = await c.env.DB.prepare(`SELECT * FROM clients WHERE id=?`).bind(id).first();
  if (!client) return c.json({ error: "not_found" }, 404);
  const program = await c.env.DB.prepare(
    `SELECT * FROM programs WHERE client_id=? ORDER BY created_at DESC LIMIT 1`,
  ).bind(id).first();
  const { results: flags } = await c.env.DB.prepare(
    `SELECT * FROM safety_flags WHERE client_id=? ORDER BY created_at DESC`,
  ).bind(id).all();
  return c.json({
    client,
    program: program ? { ...program, output: JSON.parse(String(program.output)) } : null,
    flags,
  });
});

app.post("/api/coach/program/:id/approve", async (c) => {
  const id = c.req.param("id");
  const { notes, startsOn } = await c.req
    .json<{ notes?: string; startsOn?: string }>()
    .catch(() => ({ notes: undefined, startsOn: undefined }));

  const row = await c.env.DB.prepare(`SELECT client_id FROM programs WHERE id=?`)
    .bind(id)
    .first<{ client_id: string }>();
  if (!row) return c.json({ error: "not_found" }, 404);

  await c.env.DB.batch([
    // One active program per client, so retire the others before activating.
    c.env.DB.prepare(`UPDATE programs SET is_active=0 WHERE client_id=? AND id<>?`)
      .bind(row.client_id, id),
    c.env.DB.prepare(
      `UPDATE programs SET coach_approved=1, coach_notes=?, starts_on=?, is_active=1 WHERE id=?`,
    ).bind(notes ?? null, startsOn ?? null, id),
  ]);
  return c.json({ ok: true });
});

app.post("/api/coach/flag/:flagId/resolve", async (c) => {
  const { by } = await c.req.json<{ by?: string }>().catch(() => ({ by: undefined }));
  await c.env.DB.prepare(
    `UPDATE safety_flags SET resolved_at=datetime('now'), resolved_by=? WHERE id=?`,
  ).bind(by ?? "coach", c.req.param("flagId")).run();
  return c.json({ ok: true });
});

/* ---------------- static ---------------- */

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
