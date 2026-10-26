// Drones emails (HTML + plain text), same design system as the ai.sleepysquid.com intake email
// and the sleepysquid.com contact email. All user input is escaped. Empty fields are hidden.
// Headers are PNGs with baked-in white text so Gmail's forced dark-mode inversion can't recolor them.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const C = { ink: "#0d1b2a", body: "#3b4a59", muted: "#6b7785", line: "#e3ebf2", bg: "#eef5fb", card: "#ffffff", brand: "#0c74bc", deep: "#1c5090", green: "#0b6e4f" };
const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

export const CONTACT_HEADER_IMG = "https://drones.sleepysquid.com/email/drones-contact-header.png";
export const BOOKING_HEADER_IMG = "https://drones.sleepysquid.com/email/drones-booking-header.png";

const DARK_CSS = `:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
.dm-bg{background-color:#0b1520!important}
.dm-card{background-color:#14212e!important}
.dm-ink{color:#eef3f8!important}
.dm-body{color:#c3cfdb!important}
.dm-muted{color:#9aa8b6!important}
.dm-label{color:#6ee7b7!important}
.dm-pill{background-color:#1d3043!important;color:#bfdbfe!important}
.dm-warn{background-color:#3a2a0c!important;color:#fcd34d!important}
.dm-ok{background-color:#0f2e22!important;border-color:#1f5a43!important;color:#a7f3d0!important}
.dm-quote{background-color:#1a2a3a!important;color:#eef3f8!important}
.dm-foot{background-color:#0f1a26!important;border-color:#24364a!important;color:#9aa8b6!important}
.dm-ink a,.dm-muted a,.dm-body a,.dm-foot a{color:#7cc4f5!important}
}`;

const row = (k, v) => `<tr><td class="dm-muted" style="padding:6px 12px 6px 0;width:130px;color:${C.muted};font-size:14px;vertical-align:top;">${esc(k)}</td><td class="dm-ink" style="padding:6px 0;color:${C.ink};font-size:15px;vertical-align:top;word-break:break-word;">${v}</td></tr>`;
const rows = (list) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${list.map(([k, v]) => row(k, v)).join("")}</table>`;
const section = (title, inner) => `<tr><td class="dm-card" style="padding:0 28px 22px;background-color:${C.card};"><div class="dm-label" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.green};font-weight:700;margin:0 0 8px;">${esc(title)}</div>${inner}</td></tr>`;
const btn = (href, label, bg, fg, extra = "") => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 22px;border-radius:10px;background-color:${bg};color:${fg};font-size:15px;font-weight:700;text-decoration:none;${extra}">${esc(label)}</a>`;
const link = (href, label) => `<a href="${esc(href)}" style="color:${C.brand};text-decoration:underline;">${esc(label)}</a>`;
const quote = (s) => `<div class="dm-quote" style="border-left:4px solid ${C.brand};background-color:#f5f9fc;padding:12px 16px;color:${C.ink};font-size:15px;line-height:1.55;border-radius:0 8px 8px 0;">${esc(s).replace(/\n/g, "<br>")}</div>`;
const header = (src, alt) => `<tr><td class="dm-head" bgcolor="${C.deep}" style="padding:0;background-color:${C.deep};background-image:linear-gradient(135deg,${C.deep},${C.brand});"><img src="${src}" width="600" alt="${esc(alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#ffffff;font-size:18px;font-weight:800;font-family:${FONT};line-height:76px;"></td></tr>`;
const foot = (inner) => `<tr><td class="dm-foot" style="padding:14px 28px;background-color:${C.bg};color:${C.muted};font-size:12px;line-height:1.6;border-top:1px solid ${C.line};">${inner}</td></tr>`;
const shell = (title, parts) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title><style>${DARK_CSS}</style></head><body class="body dm-bg" style="margin:0;padding:0;background-color:${C.bg};"><u></u><table class="dm-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="dm-card" style="max-width:600px;width:100%;border-collapse:separate;border-radius:14px;overflow:hidden;background-color:${C.card};font-family:${FONT};">${parts.join("")}</table></td></tr></table></body></html>`;
const clean = (lines) => lines.filter((x) => x !== null && x !== undefined).join("\n");

/** Admin notification for the drones contact form. d = { name, email, subject, message, timestamp, clientIp, userAgent } */
export function buildContactEmail(d) {
  const first = String(d.name || "").trim().split(/\s+/)[0] || "sender";
  const mailto = `mailto:${d.email}?subject=${encodeURIComponent("Re: " + (d.subject || "your SleepySquid Drones message"))}`;
  const contact = [["From", has(d.name) && esc(d.name)], ["Email", has(d.email) && link(`mailto:${d.email}`, d.email)], ["Subject", has(d.subject) && esc(d.subject)], ["Submitted", has(d.timestamp) && esc(d.timestamp)]].filter(([, v]) => v);
  const tech = [["IP Address", has(d.clientIp) && esc(d.clientIp)], ["User Agent", has(d.userAgent) && esc(d.userAgent)]].filter(([, v]) => v);

  const p = [header(CONTACT_HEADER_IMG, "SleepySquid Drones: New contact message")];
  p.push(`<tr><td class="dm-card" style="padding:26px 28px 18px;background-color:${C.card};"><div class="dm-ink" style="font-size:26px;line-height:1.2;font-weight:800;color:${C.ink};">${esc(d.name)}</div>${has(d.subject) ? `<div style="margin-top:14px;"><span class="dm-pill" style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#dbeafe;color:#1e40af;font-size:13px;font-weight:700;line-height:1.3;">${esc(d.subject)}</span></div>` : ""}</td></tr>`);
  if (contact.length) p.push(section("Contact", rows(contact)));
  if (has(d.message)) p.push(section("Message", quote(d.message)));
  if (has(d.email)) p.push(`<tr><td class="dm-card" style="padding:6px 28px 26px;background-color:${C.card};">${btn(mailto, "Reply to " + first, C.green, "#ffffff")}</td></tr>`);
  p.push(foot(`${tech.length ? `<div style="font-weight:700;margin-bottom:2px;">Technical details</div>${tech.map(([k, v]) => `<div>${esc(k)}: ${v}</div>`).join("")}` : ""}<div style="margin-top:6px;">This email was automatically generated from the SleepySquid Drones contact form.</div>`));

  const t = ["New contact form submission received:", "", has(d.name) ? `From: ${d.name}` : null, has(d.email) ? `Email: ${d.email}` : null, has(d.subject) ? `Subject: ${d.subject}` : null];
  if (has(d.message)) t.push("", "Message:", d.message);
  t.push("", "---", "Technical Details:", has(d.timestamp) ? `Submitted: ${d.timestamp}` : null, has(d.clientIp) ? `IP Address: ${d.clientIp}` : null, has(d.userAgent) ? `User Agent: ${d.userAgent}` : null);
  return { html: shell("New Contact Form Submission", p), text: clean(t) };
}

/**
 * Customer booking confirmation.
 * b = { id, name, serviceDisplayName, packageDisplayName, formattedDate, location, estimatedPriceLabel, details }
 * o = { hasAccount, loginUrl, appName, supportEmail }
 */
export function buildBookingEmail(b, o) {
  const { hasAccount = false, loginUrl, appName = "SleepySquid Drones", supportEmail } = o || {};
  const location = has(b.location) ? b.location : "TBD";
  const steps = ["Our team will review your booking request", "We'll contact you to confirm availability", "We'll discuss any specific requirements and finalize details", "You'll receive a final confirmation with payment instructions"];
  const details = [["Booking ID", has(b.id) && esc(b.id)], ["Service", has(b.serviceDisplayName) && esc(b.serviceDisplayName)], ["Package", has(b.packageDisplayName) && esc(b.packageDisplayName)], ["Date", has(b.formattedDate) && esc(b.formattedDate)], ["Location", esc(location)], ["Estimated Price", has(b.estimatedPriceLabel) && `<strong>${esc(b.estimatedPriceLabel)}</strong>`], ["Status", `<span class="dm-warn" style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:#fef3c7;color:#92400e;font-size:13px;font-weight:700;">Pending Confirmation</span>`]].filter(([, v]) => v);

  const p = [header(BOOKING_HEADER_IMG, `${appName}: Booking confirmed`)];
  p.push(`<tr><td class="dm-card" style="padding:26px 28px 18px;background-color:${C.card};"><div class="dm-ink" style="font-size:24px;line-height:1.25;font-weight:800;color:${C.ink};">Thank you${has(b.name) ? ", " + esc(b.name) : ""}!</div><div class="dm-body" style="font-size:15px;line-height:1.55;color:${C.body};margin-top:8px;">We've received your booking request and will contact you to confirm the details.</div>${has(b.serviceDisplayName) ? `<div style="margin-top:14px;"><span class="dm-pill" style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#dbeafe;color:#1e40af;font-size:13px;font-weight:700;line-height:1.3;">${esc(b.serviceDisplayName)}${has(b.formattedDate) ? " &middot; " + esc(b.formattedDate) : ""}</span></div>` : ""}</td></tr>`);
  p.push(section("Booking details", rows(details)));
  if (has(b.details)) p.push(section("Additional details", quote(b.details)));
  if (!hasAccount) p.push(section("Manage your bookings", `<div class="dm-body" style="font-size:15px;line-height:1.55;color:${C.body};margin:0 0 14px;">Create an account to easily manage your bookings, view status updates, and track your service history.</div>${btn(loginUrl, "Create Account & Manage Bookings", C.green, "#ffffff")}<div class="dm-muted" style="font-size:13px;color:${C.muted};margin-top:6px;">You can access your booking using ID: <strong>${esc(b.id)}</strong></div>`));
  p.push(section("What happens next?", `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">${steps.map((s, i) => `<tr><td style="width:34px;padding:4px 0;vertical-align:top;"><span class="dm-pill" style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background-color:#dbeafe;color:#1e40af;font-size:13px;font-weight:700;">${i + 1}</span></td><td class="dm-body" style="padding:6px 0;color:${C.body};font-size:15px;line-height:1.45;vertical-align:top;">${esc(s)}</td></tr>`).join("")}</table>`));
  if (has(supportEmail)) p.push(`<tr><td class="dm-card" style="padding:0 28px 26px;background-color:${C.card};"><div class="dm-body" style="font-size:15px;color:${C.body};">Need to make changes or have questions? Contact us at ${link(`mailto:${supportEmail}`, supportEmail)}</div></td></tr>`);
  p.push(foot(`<div style="font-weight:700;">${esc(appName)}</div><div>Professional drone photography, videography, and specialized aerial services</div><div>FAA Part 107 Certified &amp; Insured. $1M liability coverage.</div>`));

  const t = [`${appName} - Booking Confirmation`, "", `Thank you${has(b.name) ? " " + b.name : ""}! We've received your booking request and will contact you to confirm the details.`, "", "BOOKING DETAILS:", "================", ...details.map(([k]) => k).map((k) => ({ "Booking ID": b.id, Service: b.serviceDisplayName, Package: b.packageDisplayName, Date: b.formattedDate, Location: location, "Estimated Price": b.estimatedPriceLabel, Status: "Pending Confirmation" }[k])).map((v, i) => `${details[i][0]}: ${v}`)];
  if (has(b.details)) t.push("", `Additional Details: ${b.details}`);
  if (!hasAccount) t.push("", "MANAGE YOUR BOOKINGS:", "====================", "Create an account to easily manage your bookings, view status updates, and track your service history.", `Visit: ${loginUrl}`, `Your booking ID: ${b.id}`);
  t.push("", "WHAT HAPPENS NEXT:", "==================", ...steps.map((s, i) => `${i + 1}. ${s}`));
  if (has(supportEmail)) t.push("", `Questions? Contact us at ${supportEmail}`);
  t.push("", appName, "Professional drone photography, videography, and specialized aerial services", "FAA Part 107 Certified & Insured. $1M liability coverage.");
  return { html: shell("Booking Confirmation", p), text: clean(t) };
}
