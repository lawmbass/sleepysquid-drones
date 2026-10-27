// Server-only: a client's portal login (drones account link + AI report login) and the AI portal record
// behind an AI client. Used by the Clients admin API. Never sends email.
import { db as sdb, assertNoError } from "@/libs/db/shared";
import { findUserById, patchUser, listUsers } from "@/libs/db/users";
import { listPendingInvitations } from "@/libs/db/invitations";
import { adminConfig } from "@/libs/adminConfig";
import { db as pdb, enc, portalConfigured } from "@/libs/aiPortal/access";

const CLIENT_ROLES = ["client", "user"];
const DEFAULT_RATE = 19;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "client";
const portalOn = () => { try { return portalConfigured(); } catch { return false; } };

/** { portalClientId: [login emails] } for every AI portal client. Empty when the AI portal isn't configured. */
export async function aiLoginMap() {
  if (!portalOn()) return {};
  const rows = await pdb("portal_client_users?select=email,client_id");
  const m = {};
  for (const r of rows || []) (m[r.client_id] ||= []).push(String(r.email).toLowerCase());
  return m;
}

/**
 * Remove a client's portal login, keep the client row (and its invoices, report data and API keys).
 * - unlinks the drones account (user_id) and clears invited_at so it won't re-link on next sign-in;
 * - turns off dashboard access on that account if it's a client account (never touches admins/pilots);
 * - removes the AI report login emails for its AI portal client.
 */
export async function removeClientLogin(c, actorEmail) {
  if (c.user_id) {
    const u = await findUserById(c.user_id);
    if (u && CLIENT_ROLES.includes(u.role || "client") && !adminConfig.isAdmin(u.email) && u.hasAccess) {
      await patchUser(u.id, { hasAccess: false, pushAccessHistory: { hasAccess: false, changedBy: actorEmail, changedAt: new Date().toISOString(), reason: "Client login removed on the Clients page", action: "deactivated" } });
    }
  }
  if (c.portal_client_id && portalOn()) await pdb(`portal_client_users?client_id=eq.${enc(c.portal_client_id)}`, { method: "DELETE" });
  const { data, error } = await sdb().from("clients").update({ user_id: null, invited_at: null, updated_at: new Date().toISOString() }).eq("id", c.id).select("*").maybeSingle();
  assertNoError(error);
  return data;
}

/** Turn off a client account that has no client record (from the "Logins without a client" list). */
export async function removeUserLogin(userId, actorEmail) {
  const u = await findUserById(userId);
  if (!u) return { error: [404, "Account not found"] };
  if (!CLIENT_ROLES.includes(u.role || "client") || adminConfig.isAdmin(u.email)) return { error: [400, "That's a team account. Manage it on the Team page."] };
  if (u.hasAccess) await patchUser(u.id, { hasAccess: false, pushAccessHistory: { hasAccess: false, changedBy: actorEmail, changedAt: new Date().toISOString(), reason: "Client login removed on the Clients page", action: "deactivated" } });
  return { ok: true };
}

/** On invite: restore the AI report login for an AI client (its email), so the invite actually works there too. */
export async function grantAiLogin(c) {
  if (!c.portal_client_id || !c.email || !portalOn()) return;
  await pdb("portal_client_users?on_conflict=email,client_id", { method: "POST", body: { email: c.email.toLowerCase(), client_id: c.portal_client_id }, prefer: "resolution=ignore-duplicates" });
}

/**
 * Keep the AI portal record in step with the client (what "Add/Edit AI client" did on the old Users page):
 * AI on and no portal client -> create one; name/rate edits -> copied over; email edits -> login moves if it had one.
 * Returns a clients patch ({portal_client_id}) or null.
 */
export async function syncAiPortal(row, before = null) {
  if (!portalOn() || !(row.services || []).includes("ai")) return null;
  const rate = row.hourly_rate == null ? null : Number(row.hourly_rate);
  if (!row.portal_client_id) {
    let id = slug(row.business_name), n = 1;
    while ((await pdb(`portal_clients?id=eq.${enc(id)}&select=id`)).length) id = `${slug(row.business_name).slice(0, 46)}-${++n}`;
    await pdb("portal_clients", { method: "POST", body: { id, name: row.business_name, hourly_rate: rate ?? DEFAULT_RATE, currency: "USD", timezone: "America/New_York" } });
    return { portal_client_id: id };
  }
  const patch = { name: row.business_name };
  if (rate != null && rate > 0) patch.hourly_rate = rate;
  await pdb(`portal_clients?id=eq.${enc(row.portal_client_id)}`, { method: "PATCH", body: patch });
  if (before && row.email && before.email && row.email !== before.email) {
    const had = await pdb(`portal_client_users?client_id=eq.${enc(row.portal_client_id)}&email=eq.${enc(before.email)}&select=email`);
    if (had.length) {
      await pdb(`portal_client_users?client_id=eq.${enc(row.portal_client_id)}&email=eq.${enc(before.email)}`, { method: "DELETE" });
      await grantAiLogin(row);
    }
  }
  return null;
}

/** Archive = old "Delete AI client" for the AI side (report login stops, API keys revoked); unarchive = restore. */
export async function archiveAiPortal(row, archived) {
  if (!row.portal_client_id || !portalOn()) return;
  const id = enc(row.portal_client_id), now = new Date().toISOString();
  await pdb(`portal_clients?id=eq.${id}`, { method: "PATCH", body: { deleted_at: archived ? now : null } });
  if (archived) await pdb(`portal_api_keys?client_id=eq.${id}&revoked_at=is.null`, { method: "PATCH", body: { revoked_at: now } });
}

/** Old "Delete permanently": erase an archived client's AI portal data (reports, keys, automations, logins). Client row stays. */
export async function purgeAiPortal(row) {
  if (!row.portal_client_id || !portalOn()) return null;
  const counts = await pdb("rpc/hard_delete_client", { method: "POST", body: { p_id: row.portal_client_id } });
  const { data, error } = await sdb().from("clients").update({ portal_client_id: null, updated_at: new Date().toISOString() }).eq("id", row.id).select("*").maybeSingle();
  assertNoError(error);
  return { row: data, counts };
}

/** Client accounts (and pending client invitations) with no client record, so they stay reachable from Clients. */
export async function loginsWithoutClient(rows) {
  const linked = new Set(rows.map((r) => r.user_id).filter(Boolean));
  const byEmail = new Map(rows.filter((r) => r.email).map((r) => [r.email.toLowerCase(), r]));
  const { users } = await listUsers({ limit: 2000 });
  const invites = await listPendingInvitations({});
  const isClient = (x) => CLIENT_ROLES.includes(x.role || "client") && !adminConfig.isAdmin(x.email || "");
  const out = users.filter((u) => isClient(u) && !linked.has(u.id)).map((u) => ({
    kind: "user", id: u.id, name: u.name || null, email: u.email, company: u.company || null, phone: u.phone || null,
    hasAccess: Boolean(u.hasAccess), createdAt: u.createdAt || null, matchClientId: byEmail.get(String(u.email || "").toLowerCase())?.id || null,
  }));
  for (const i of invites.filter(isClient)) {
    if (byEmail.has(String(i.email || "").toLowerCase())) continue;
    out.push({ kind: "invitation", id: i._id, name: i.name || null, email: i.email, company: i.company || null, phone: i.phone || null, hasAccess: false, createdAt: i.invitedAt || null, matchClientId: null });
  }
  return out;
}

/** Link an existing client account to a client record (admin click; no email). Grants it dashboard access. */
export async function linkUserToClient(c, userId, actorEmail) {
  const u = await findUserById(userId);
  if (!u) return { error: [404, "Account not found"] };
  if (!CLIENT_ROLES.includes(u.role || "client") || adminConfig.isAdmin(u.email)) return { error: [400, "Team accounts can't be linked to a client."] };
  const { data: other } = await sdb().from("clients").select("id").eq("user_id", u.id).neq("id", c.id).limit(1);
  if (other?.length) return { error: [409, "That login already belongs to another client."] };
  if (!u.hasAccess) await patchUser(u.id, { hasAccess: true, pushAccessHistory: { hasAccess: true, changedBy: actorEmail, changedAt: new Date().toISOString(), reason: "Linked to a client on the Clients page", action: "activated" } });
  const { data, error } = await sdb().from("clients").update({ user_id: u.id, updated_at: new Date().toISOString() }).eq("id", c.id).select("*").maybeSingle();
  assertNoError(error);
  return { row: data };
}

/** AI report login emails for one AI portal client. */
export async function aiLoginsFor(portalClientId) {
  if (!portalClientId || !portalOn()) return [];
  return (await pdb(`portal_client_users?client_id=eq.${enc(portalClientId)}&select=email`)).map((r) => String(r.email).toLowerCase());
}
