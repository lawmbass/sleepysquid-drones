// Referral-link email for a referrer. The caller passes the Resend helper
// (libs/mailgun.js sendEmail). This module never reads API keys.
import { normalizeEmail, shareLinks, signReferrerToken } from "./referralHub.mjs";

const enc = (value) => encodeURIComponent(value);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const C = {
  ink: "#102033",
  body: "#3d4d5c",
  muted: "#5c6b7a",
  line: "#e4ebf2",
  bg: "#f3f6fa",
  card: "#ffffff",
  brand: "#1d6fbf",
  deep: "#0e3a66",
};

export const REFERRAL_LINK_SUBJECT = "Your SleepySquid referral link";
export const REFERRAL_EMAIL_FAILED = "Could not send the referral email";

export function referrerLinks(referrer, origin, secret) {
  const base = String(origin || "https://sleepysquid.com").replace(/\/$/, "");
  const links = shareLinks(referrer?.code, base);
  const token = signReferrerToken(referrer?.id, secret);
  return { ...links, home: token ? `${base}/referrals/you/${token}` : "" };
}

function linkBlock(label, href) {
  return `<p style="margin:0 0 12px;">
    <span style="display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};font-weight:700;">${esc(label)}</span>
    <a href="${esc(href)}" style="color:${C.brand};font-size:14px;line-height:1.45;word-break:break-all;text-decoration:underline;">${esc(href)}</a>
  </p>`;
}

/** Plain SleepySquid email. No client prices. */
export function buildReferrerLinkEmail({ name, links }) {
  const first = String(name || "").trim().split(/\s+/)[0] || "there";
  const home = links?.home || "";
  const share = [
    ["Your link", links?.hub],
    ["Websites", links?.web],
    ["Drones", links?.drones],
    ["AI", links?.ai],
  ].filter(([, href]) => href);

  const privateBlock = home
    ? `<p style="margin:22px 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${C.deep};font-weight:700;">Your private page</p>
       <p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:${C.body};">This page is only for you. Keep this page link private.</p>
       <p style="margin:0;font-size:14px;line-height:1.45;word-break:break-all;"><a href="${esc(home)}" style="color:${C.brand};text-decoration:underline;">${esc(home)}</a></p>`
    : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(REFERRAL_LINK_SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.card};border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:${C.deep};padding:22px 28px;">
<div style="color:#ffffff;font-size:22px;font-weight:800;">SleepySquid</div>
<div style="color:#d6e6f5;font-size:13px;margin-top:4px;">sleepysquid.com</div>
</td></tr>
<tr><td style="padding:28px 28px 32px;">
<p style="margin:0 0 12px;font-size:16px;color:${C.ink};">Hi ${esc(first)},</p>
<p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:${C.body};">You earn <strong style="color:${C.ink};">$200</strong> when a customer you refer makes their first eligible payment. There is no cap.</p>
<p style="margin:0 0 10px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${C.deep};font-weight:700;">Share these links</p>
${share.map(([label, href]) => linkBlock(label, href)).join("")}
${privateBlock}
</td></tr>
<tr><td style="padding:14px 28px 18px;border-top:1px solid ${C.line};color:${C.muted};font-size:12px;line-height:1.5;">
SleepySquid · <a href="https://sleepysquid.com" style="color:${C.brand};text-decoration:none;">sleepysquid.com</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Hi ${first},`,
    "",
    "You earn $200 when a customer you refer makes their first eligible payment. There is no cap.",
    "",
    ...share.map(([label, href]) => `${label}: ${href}`),
    home ? "" : null,
    home ? "Your private page (keep this page link private):" : null,
    home || null,
    "",
    "SleepySquid",
    "https://sleepysquid.com",
  ].filter((line) => line !== null).join("\n");

  return { subject: REFERRAL_LINK_SUBJECT, html, text };
}

async function remember(db, id, body) {
  await db(`portal_referrers?id=eq.${enc(id)}`, { method: "PATCH", body, prefer: "return=minimal" });
}

/**
 * Send one referral-link email. No email means no send.
 * A send failure is returned, never thrown, and does not clear an earlier sent time.
 */
export async function sendReferrerLinkEmail(db, referrer, { origin, secret, send, replyTo, now } = {}) {
  const links = referrerLinks(referrer, origin, secret);
  const to = normalizeEmail(referrer?.email);
  if (!to) return { sent: false, skipped: "no_email", links };
  const message = buildReferrerLinkEmail({ name: referrer?.name, links });
  const clock = now || (() => new Date());
  try {
    if (typeof send !== "function") throw new Error("mailer missing");
    await send({
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: replyTo || "support@sleepysquid.com",
      fromName: "SleepySquid",
    });
  } catch {
    try { await remember(db, referrer.id, { link_email_error: REFERRAL_EMAIL_FAILED }); }
    catch { /* the create or approve that already happened still stands */ }
    console.error(`referral link email failed for ${referrer?.id || "unknown"}`);
    return { sent: false, error: REFERRAL_EMAIL_FAILED, links };
  }
  const sentAt = clock().toISOString();
  try {
    await remember(db, referrer.id, { link_email_sent_at: sentAt, link_email_error: null });
  } catch {
    console.error(`referral link email sent but not recorded for ${referrer?.id || "unknown"}`);
    return { sent: true, sentAt, recorded: false, links };
  }
  return { sent: true, sentAt, recorded: true, links };
}
