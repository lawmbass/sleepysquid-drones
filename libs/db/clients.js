// Server-only: public.clients (after 20261027040000_clients_merge.sql). Service role; admin API only.
import { assertNoError, db, isUuid } from "@/libs/db/shared";

let ready = null;
let notReadyAt = 0;
/** True once the clients merge migration is applied (cached once true; a "no" is re-checked after 60s). */
export async function clientsReady() {
  if (ready) return true;
  if (Date.now() - notReadyAt < 60_000) return false;
  const { error } = await db().from("clients").select("id").limit(1);
  if (error) { notReadyAt = Date.now(); return false; }
  const { error: e2 } = await db().from("invoices").select("client_id").limit(1);
  if (e2) { notReadyAt = Date.now(); return false; }
  return (ready = true);
}

export async function listClients() {
  const { data, error } = await db().from("clients").select("*").order("business_name").limit(2000);
  assertNoError(error);
  const { data: inv, error: e2 } = await db().from("invoices").select("client_id,amount_due_cents,status,created_at").not("client_id", "is", null).neq("status", "deleted").limit(5000);
  assertNoError(e2);
  const agg = {};
  for (const i of inv || []) {
    const a = (agg[i.client_id] ||= { owedCents: 0, lastInvoiceAt: null });
    if (i.status === "open") a.owedCents += Number(i.amount_due_cents) || 0;
    if (!a.lastInvoiceAt || i.created_at > a.lastInvoiceAt) a.lastInvoiceAt = i.created_at;
  }
  return { rows: data || [], agg };
}
export async function getClient(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("clients").select("*").eq("id", id).maybeSingle();
  assertNoError(error);
  return data;
}
export async function findClientBy(col, value) {
  if (!["user_id", "portal_client_id", "email"].includes(col) || !value) return null;
  const { data, error } = await db().from("clients").select("*").eq(col, value).maybeSingle();
  assertNoError(error);
  return data;
}
export async function insertClient(value) {
  const { data, error } = await db().from("clients").insert(value).select("*").single();
  assertNoError(error);
  return data;
}
export async function updateClient(id, patch) {
  const { data, error } = await db().from("clients").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
  assertNoError(error);
  return data;
}
export async function searchClients(term, limit = 8) {
  let q = db().from("clients").select("*").is("archived_at", null).not("email", "is", null).order("business_name").limit(limit);
  if (term) q = q.or(`business_name.ilike.%${term}%,email.ilike.%${term}%,contact_name.ilike.%${term}%`);
  const { data, error } = await q;
  assertNoError(error);
  return data || [];
}
export async function listInvoicesForClient(clientId) {
  const { data, error } = await db().from("invoices").select("*").eq("client_id", clientId).neq("status", "deleted").order("created_at", { ascending: false }).limit(100);
  assertNoError(error);
  return data || [];
}

const linked = new Set();
/**
 * Accepting a portal invite: link an invited, unlinked, unarchived client with this email to the signed-in user
 * (never admins; caller checks) and give that account dashboard access. Only invited clients link, so a client
 * whose login was removed (invited_at cleared) doesn't silently get it back on their next sign-in.
 */
export async function linkClientLogin(email, userId) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !isUuid(userId) || linked.has(e) || /@sleepysquid\.com$/.test(e) || !(await clientsReady())) return;
  const { data, error } = await db().from("clients").update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq("email", e).is("user_id", null).is("archived_at", null).not("invited_at", "is", null).select("id");
  assertNoError(error);
  if (data?.length) {
    const { error: e2 } = await db().from("users").update({ has_access: true }).eq("id", userId).in("role", ["client", "user"]);
    assertNoError(e2);
  }
  linked.add(e);
}
