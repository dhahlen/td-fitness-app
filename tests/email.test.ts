import { describe, expect, it } from "vitest";
import { sendIntakeReceipt } from "../src/email";

const client = { name: "Dana Reyes", email: "dana@example.com" };

describe("intake receipt", () => {
  it("sends nothing when no mail key is configured", async () => {
    const r = await sendIntakeReceipt({}, client, "active");
    expect(r).toEqual({ sent: false, reason: "not_configured" });
  });

  it("never emails someone the age gate blocked", async () => {
    const r = await sendIntakeReceipt({ RESEND_API_KEY: "test" }, client, "archived");
    expect(r).toEqual({ sent: false, reason: "suppressed_for_minor" });
  });

  it("carries no program numbers into the inbox", async () => {
    // A receipt lands in an inbox that may not be private, and a client whose
    // nutrition was suppressed must not receive a calorie figure by any route.
    const sent: Array<{ subject: string; text: string }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    try {
      for (const status of ["active", "pending_clearance", "manual_review"] as const) {
        await sendIntakeReceipt({ RESEND_API_KEY: "test" }, client, status);
      }
    } finally {
      globalThis.fetch = original;
    }

    expect(sent).toHaveLength(3);
    for (const mail of sent) {
      expect(mail.subject).not.toBe("");
      expect(mail.text).toMatch(/^Dana,/);
      expect(mail.text).not.toMatch(/\bkcal\b|\bcalorie|\bprotein\b|\d{3,4}\s*(kcal|g)\b/i);
    }
  });

  it("reports a failed send rather than throwing into the request", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => { throw new Error("network"); }) as typeof fetch;
    try {
      expect(await sendIntakeReceipt({ RESEND_API_KEY: "test" }, client, "active"))
        .toEqual({ sent: false, reason: "send_failed" });
    } finally {
      globalThis.fetch = original;
    }
  });
});
