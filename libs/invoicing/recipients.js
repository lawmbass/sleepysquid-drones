// Server-only: who an invoice can go to. Portal client accounts (public.users, role client/user)
// and AI clients (portal.clients, no portal account needed). Admins are never invoiceable.
import { assertNoError, db } from "@/libs/db/shared";
import { db as portalDb, portalConfigured } from "@/libs/aiPortal/db";
import { adminConfig } from "@/libs/adminConfig";
import { aiRecipientRef, emailRecipientRef, parseRecipientRef, recipientRefusal } from "./ui.mjs";

const enc = encodeURIComponent;
const isAdminEmail = (e) => adminConfig.isAdmin(e);

async function aiEmails(ids) {
  if (!ids.length) return {};
  const rows = await portalDb(`portal_client_users?client_id=in.(${ids.map(enc).join(",")})&select=email,client_id&order=email`);
  const out = {};
  for (const r of rows || []) (out[r.client_id] ||= []).push(String(r.email).toLowerCase());
  return out;
}

/** { ref, kind, userId, aiClientId, name, email, company, role, stripeCustomerId } or null. */
export async function getRecipient(ref) {
  const p = parseRecipientRef(ref);
  if (!p) return null;
  if (p.kind === "user") {
    const { data, error } = await db().from("users").select("id,name,email,company,role,stripe_customer_id").eq("id", p.id).maybeSingle();
    assertNoError(error);
    return data ? { id: data.id, ref: data.id, kind: "user", userId: data.id, aiClientId: null, name: data.name, email: data.email, company: data.company, role: data.role, stripeCustomerId: data.stripe_customer_id || null } : null;
  }
  if (p.kind === "email") return { id: emailRecipientRef(p.id), ref: emailRecipientRef(p.id), kind: "email", userId: null, aiClientId: null, name: null, email: p.id, company: null, role: null, stripeCustomerId: null };
  if (!portalConfigured()) return null;
  const [c] = await portalDb(`portal_clients?id=eq.${enc(p.id)}&deleted_at=is.null&select=id,name`);
  if (!c) return null;
  const emails = (await aiEmails([c.id]))[c.id] || [];
  return { id: aiRecipientRef(c.id), ref: aiRecipientRef(c.id), kind: "ai", userId: null, aiClientId: c.id, name: c.name, email: emails[0] || null, company: c.name, role: "client", stripeCustomerId: null };
}

/** Recipient + refusal reason (null when invoiceable). */
export async function getInvoiceableRecipient(ref) {
  const r = await getRecipient(ref);
  return { recipient: r, refusal: recipientRefusal(r, isAdminEmail) };
}

export async function getRecipientForRow(row) {
  if (row?.user_id) return getRecipient(row.user_id);
  if (row?.ai_client_id) return getRecipient(aiRecipientRef(row.ai_client_id));
  if (row?.recipient_email) return { ...(await getRecipient(emailRecipientRef(row.recipient_email))), name: row.recipient_name || null };
  return null;
}

/** { [aiClientId]: { id, name, email } } for list rows. */
export async function aiClientsByIds(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length || !portalConfigured()) return {};
  const rows = await portalDb(`portal_clients?id=in.(${uniq.map(enc).join(",")})&select=id,name`);
  const emails = await aiEmails(uniq);
  return Object.fromEntries((rows || []).map((c) => [c.id, { id: aiRecipientRef(c.id), name: c.name, email: (emails[c.id] || [])[0] || null, kind: "ai" }]));
}

const clean = (q) => String(q || "").replace(/[^\p{L}\p{N}@._+\- ]/gu, "").trim().slice(0, 60);

/** Type-ahead: client accounts (never admins) + AI clients without a portal account. */
export async function searchRecipients(q, limit = 8) {
  const term = clean(q);
  let query = db().from("users").select("id,name,email,company,role").in("role", ["client", "user"]).order("name").limit(limit * 2);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`);
  const { data, error } = await query;
  assertNoError(error);
  const users = (data || []).filter((u) => !recipientRefusal({ ...u }, isAdminEmail)).slice(0, limit)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, company: u.company, kind: "user" }));
  let ai = [];
  if (portalConfigured()) {
    try {
      const clients = await portalDb("portal_clients?deleted_at=is.null&select=id,name&order=name");
      const emails = await aiEmails((clients || []).map((c) => c.id));
      const all = Object.values(emails).flat();
      const withAccount = new Set();
      if (all.length) {
        const { data: acc, error: e2 } = await db().from("users").select("email").in("email", all);
        assertNoError(e2);
        for (const a of acc || []) withAccount.add(String(a.email).toLowerCase());
      }
      const t = term.toLowerCase();
      ai = (clients || []).map((c) => ({ id: aiRecipientRef(c.id), name: c.name, email: (emails[c.id] || [])[0] || null, kind: "ai", emails: emails[c.id] || [] }))
        .filter((c) => c.email && !c.emails.some((e) => withAccount.has(e)) && !recipientRefusal(c, isAdminEmail))
        .filter((c) => !t || [c.name, ...c.emails].some((v) => String(v).toLowerCase().includes(t)))
        .slice(0, limit).map(({ emails: _e, ...c }) => c);
    } catch (e) { console.error("AI client search failed:", e?.message); }
  }
  return [...users, ...ai];
}
