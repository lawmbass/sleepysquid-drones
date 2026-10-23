// POST {email}: emails a one-time SleepySquid sign-in link, only to active SleepySquid AI clients (and admins).
// Always answers the same way so it does not reveal which emails are registered.
import { sendEmail } from "@/libs/mailgun";
import { portalConfigured } from "@/libs/aiPortal/db";
import { originFromRequest, senderNameFor } from "@/libs/origin";
import { mayUseEmailLink, issueLoginToken } from "@/libs/aiPortal/emailLink";

const hits = new Map();
const OK = { ok: true, message: "If that email belongs to a SleepySquid AI client account, a sign-in link is on its way." };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "?";
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (list.length >= 5) return res.status(429).json({ error: "Too many requests. Please try again later." });
  list.push(now); hits.set(ip, list);

  const email = String((req.body || {}).email || "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
  if (!portalConfigured()) return res.status(200).json(OK);
  try {
    if (!(await mayUseEmailLink(email))) return res.status(200).json(OK);
    const token = await issueLoginToken(email, now);
    if (!token) return res.status(200).json(OK);
    const base = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const link = `${base}/login?link=${token}`;
    await sendEmail({
      to: email,
      fromName: senderNameFor(originFromRequest(req, (req.body || {}).from)),
      subject: "Your SleepySquid AI sign-in link",
      text: `Sign in to your SleepySquid client portal:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
      html: `<p>Sign in to your SleepySquid client portal:</p><p><a href="${link}" style="background:#34d399;color:#0a1f3a;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Sign in</a></p><p style="color:#7c8084">This link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
    });
    return res.status(200).json(OK);
  } catch (e) {
    console.error("email-link failed:", e?.message);
    return res.status(502).json({ error: "We couldn't send the email. Please try again." });
  }
}
