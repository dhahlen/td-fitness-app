/**
 * Transactional email. Nothing sends unless RESEND_API_KEY is set, so a
 * deployment without the secret degrades to silence rather than to an error.
 *
 * Program numbers are deliberately absent from every message. A receipt goes
 * to an inbox that may not be private, and a client whose nutrition was
 * suppressed must never receive a calorie figure by another route.
 */
export interface MailEnv {
  RESEND_API_KEY?: string;
  INTAKE_FROM_EMAIL?: string;
}

export type IntakeStatus = "active" | "pending_clearance" | "manual_review" | "archived";

const SUBJECT: Record<Exclude<IntakeStatus, "archived">, string> = {
  active: "Your intake is in, and your program is being reviewed",
  pending_clearance: "Your intake is in, and we need a doctor's sign-off",
  manual_review: "Your intake is in, and your coach will be in touch",
};

const BODY: Record<Exclude<IntakeStatus, "archived">, string> = {
  active:
    "Thanks for taking the time over that. Your program has been generated and your coach is " +
    "reviewing it now. You will hear back with the finished version and a start date.",
  pending_clearance:
    "Thanks for taking the time over that. You answered yes to one or more of the health " +
    "screening questions, so we need your doctor to sign off before you start. Your coach will " +
    "send you a clearance form to take to them. Your training plan is written and waiting.",
  manual_review:
    "Thanks for taking the time over that. Based on what you shared, your coach is putting your " +
    "plan together personally rather than letting it issue automatically. They will contact you " +
    "directly to talk it through.",
};

export interface Receipt {
  sent: boolean;
  reason?: "not_configured" | "suppressed_for_minor" | "send_failed";
}

export async function sendIntakeReceipt(
  env: MailEnv,
  client: { name: string; email: string },
  status: IntakeStatus,
): Promise<Receipt> {
  // Nothing is sent to someone the age gate blocked.
  if (status === "archived") return { sent: false, reason: "suppressed_for_minor" };
  if (!env.RESEND_API_KEY) return { sent: false, reason: "not_configured" };

  const first = client.name.trim().split(/\s+/)[0] ?? "there";
  const text = `${first},\n\n${BODY[status]}\n\nIf anything you told us changes, reply to this email and we will update it.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.INTAKE_FROM_EMAIL ?? "intake@example.com",
      to: [client.email],
      subject: SUBJECT[status],
      text,
    }),
  }).catch(() => null);

  return res?.ok ? { sent: true } : { sent: false, reason: "send_failed" };
}
