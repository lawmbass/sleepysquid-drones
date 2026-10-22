// Server-only: read the SleepySquid AI client portal data (schema "portal" in this Supabase project) with the service role.
// Same tables the ai.sleepysquid.com portal uses; this app only reads them, except the one-time sign-in link table.
const URL_ = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const portalConfigured = () => !!(URL_() && KEY());

export async function db(path, { method = "GET", body, prefer } = {}) {
  path = path.replace(/^portal_/, "");
  const r = await fetch(`${URL_()}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY(), Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json", "Accept-Profile": "portal", "Content-Profile": "portal", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`portal db ${method} ${path.split("?")[0]} ${r.status}`);
  return text ? JSON.parse(text) : null;
}

const enc = encodeURIComponent;
// Portal client ids a signed-in email maps to: only clients that are not soft-deleted.
export async function activeClientIds(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !portalConfigured()) return [];
  const ids = (await db(`portal_client_users?email=eq.${enc(e)}&select=client_id&order=client_id`)).map((l) => l.client_id);
  if (!ids.length) return [];
  const live = new Set((await db(`portal_clients?id=in.(${ids.map(enc).join(",")})&deleted_at=is.null&select=id`)).map((c) => c.id));
  return ids.filter((id) => live.has(id));
}
// Never throws: any failure means "not an AI client" (fail closed, no data shown).
export async function safeActiveClientIds(email) {
  try { return await activeClientIds(email); } catch (e) { console.error("AI portal lookup failed:", e?.message); return []; }
}
