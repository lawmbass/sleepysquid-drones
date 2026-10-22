// Shared auth/client resolution for the AI automation APIs (replaces ai.sleepysquid.com lib/portalPage).
// Clients only ever get client ids mapped to their sign-in email. Admins (drones adminConfig) may pick any live client.
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { db, activeClientIds, portalConfigured } from "./db";
export const VALID_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const enc = encodeURIComponent;
export async function sessionEmail(req, res) {
  const s = await getServerSession(req, res, authOptions);
  return s?.user?.email?.toLowerCase() || null;
}
export const isAdmin = (email) => !!email && adminConfig.isAdmin(email);
// {email, admin, ids, clientId} or null (not linked). Throws only on db failure.
export async function resolveClient(email, want) {
  const admin = isAdmin(email);
  const ids = admin ? (await db("portal_clients?deleted_at=is.null&select=id&order=name")).map((c) => c.id) : await activeClientIds(email);
  if (!ids.length) return { email, admin, ids, clientId: null };
  const w = String(want || "");
  return { email, admin, ids, clientId: ids.includes(w) ? w : ids[0] };
}
// Writes: JSON only and same-site origin (cookies are SameSite=Lax too).
const OK_HOSTS = /^(?:[a-z0-9-]+\.)*sleepysquid\.com$|^localhost$|^[a-z0-9-]+\.vercel\.app$/;
export function badWrite(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) return [415, "JSON required"];
  const o = req.headers.origin;
  if (o) { try { if (!OK_HOSTS.test(new URL(o).hostname)) return [403, "Bad origin"]; } catch { return [403, "Bad origin"]; } }
  return null;
}
export { db, portalConfigured };
export async function keyInfo(clientId) {
  const [k] = await db(`portal_api_keys?client_id=eq.${enc(clientId)}&revoked_at=is.null&expires_at=gt.${enc(new Date().toISOString())}&select=created_at,expires_at&order=created_at.desc&limit=1`);
  return k || null;
}
