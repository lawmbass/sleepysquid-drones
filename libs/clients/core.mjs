/** Browser-safe Clients helpers (spec: clients-merge). */
import { isValidEmail } from "../invoicing/ui.mjs";
export const SERVICES = ["drones", "ai", "web"];
export const SERVICE_LABEL = { drones: "Drones", ai: "AI", web: "Web" };
export const CLIENT_FILTERS = ["all", "drones", "ai", "web", "owes"];
export const CLIENT_FILTER_LABEL = { all: "All", drones: "Drones", ai: "AI", web: "Web", owes: "Owes money" };
export const CLIENT_REF_PREFIX = "client:";
export const clientRef = (id) => `${CLIENT_REF_PREFIX}${id}`;
export const INVITE_RESEND_MS = 10 * 60 * 1000;   // one invite email per client per 10 minutes
export const INVITE_DAILY_MAX = 5;

const t = (v, max) => { const s = String(v ?? "").trim(); return s ? s.slice(0, max) : null; };

/** Validate a create/update body. Only business name is required; email only to invite or invoice. Rate only when AI is on, never defaulted. */
export function validateClient(body = {}) {
  const errors = {};
  const business_name = t(body.businessName ?? body.business_name, 160);
  if (!business_name) errors.businessName = "Business name is required";
  const email = t(body.email, 254)?.toLowerCase() || null;
  if (email && !isValidEmail(email)) errors.email = "Enter a valid email";
  if (email && /@sleepysquid\.com$/i.test(email)) errors.email = "SleepySquid staff emails can't be clients";
  const services = [...new Set((Array.isArray(body.services) ? body.services : []).filter((s) => SERVICES.includes(s)))].sort();
  let hourly_rate = null;
  const rawRate = body.hourlyRate ?? body.hourly_rate;
  if (services.includes("ai") && rawRate !== "" && rawRate != null) {
    const n = Number(rawRate);
    if (!Number.isFinite(n) || n < 0 || n > 10000) errors.hourlyRate = "Enter an hourly rate between 0 and 10,000";
    else hourly_rate = Math.round(n * 100) / 100;
  }
  const value = { business_name, contact_name: t(body.contactName ?? body.contact_name, 120), email, phone: t(body.phone, 40), services, hourly_rate, notes: t(body.notes, 4000) };
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

export const canInvite = (c) => Boolean(c && c.email && !c.archivedAt && !c.userId);
/** True when the client can sign in somewhere: a linked drones account or an AI report login email. */
export const hasLogin = (c) => Boolean(c && (c.userId || (c.aiLogins || []).length));
/** "Remove login" is offered when there's a login or an outstanding invite to take back. */
export const canRemoveLogin = (c) => Boolean(c && (hasLogin(c) || c.invitedAt));
export const removeLoginText = (c) => `${c.businessName} won't be able to sign in to the client portal${(c.aiLogins || []).length ? " or see their AI report" : ""}. The client, their invoices${c.portalClientId ? ", AI report data and API keys" : ""} stay. You can invite them again later.`;
export function portalStatus(c) {
  if (c?.userId) return { key: "login", label: "Has login" };
  if ((c?.aiLogins || []).length) return { key: "login", label: "AI login" };
  if (c?.invitedAt) return { key: "invited", label: `Invited ${new Date(c.invitedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` };
  return { key: "none", label: "No login" };
}
/** Why an invite can't go now, or null. */
export function inviteBlock(c, now = Date.now()) {
  if (!c) return "Client not found";
  if (c.archivedAt) return "Client is archived";
  if (c.userId) return "Client already has a login";
  if (!c.email) return "Add an email first";
  if (c.lastInviteAt && now - new Date(c.lastInviteAt).getTime() < INVITE_RESEND_MS) return "An invite was just sent. Try again in a few minutes.";
  return null;
}
export const inviteConfirmText = (email) => `Email a portal invite to ${email}?`;

export function filterClients(list, { filter = "all", q = "", showArchived = false } = {}) {
  const s = String(q || "").trim().toLowerCase();
  return list.filter((c) => (showArchived || !c.archivedAt)
    && (filter === "all" || (filter === "owes" ? c.owedCents > 0 : (c.services || []).includes(filter)))
    && (!s || [c.businessName, c.contactName, c.email, c.phone].some((v) => String(v || "").toLowerCase().includes(s))));
}
export function rowActionsFor(c) {
  const a = [];
  if (!c.archivedAt && c.email) a.push("invoice");
  if (canInvite(c)) a.push(c.invitedAt ? "resend" : "invite");
  if (canRemoveLogin(c)) a.push("remove-login");
  if (c.portalClientId) a.push("report");
  a.push("edit");
  if (!c.archivedAt) a.push("archive");
  return a;
}
export function publicClient(row, agg = {}) {
  return { id: row.id, ref: clientRef(row.id), businessName: row.business_name, contactName: row.contact_name, email: row.email, phone: row.phone,
    services: row.services || [], hourlyRate: row.hourly_rate == null ? null : Number(row.hourly_rate), notes: row.notes, userId: row.user_id,
    portalClientId: row.portal_client_id, aiLogins: agg.aiLogins || [], invitedAt: row.invited_at, lastInviteAt: row.last_invite_at || row.invited_at, archivedAt: row.archived_at,
    owedCents: agg.owedCents || 0, lastInvoiceAt: agg.lastInvoiceAt || null, createdAt: row.created_at };
}
