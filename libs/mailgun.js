// Email sending now goes through Resend (file name kept so existing imports don't change).
import config from "@/config";

if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === "development") {
  console.warn("⚠️ RESEND_API_KEY missing from .env: emails will not be sent.");
}

/**
 * Sends an email using Resend. Same signature as the old Mailgun helper.
 * @param {{to: string|string[], subject: string, text?: string, html?: string, replyTo?: string}} params
 */
export const sendEmail = async ({ to, subject, text, html, replyTo, fromName }) => {
  const defaultFrom =
    process.env.RESEND_FROM_EMAIL ||
    config.email?.from ||
    "SleepySquid Drones <noreply@send.sleepysquid.com>";
  // fromName swaps only the display name; the address stays the configured one.
  const from = fromName ? `${fromName.replace(/[<>"\r\n]/g, "")} <${(defaultFrom.match(/<([^>]+)>/) || [, defaultFrom])[1].trim()}>` : defaultFrom;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html,
      ...(replyTo && { reply_to: replyTo }),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
};
