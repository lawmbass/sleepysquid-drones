// Manage AI clients (replaces ai.sleepysquid.com /portal/admin + /api/portal/admin). Admins only, checked server-side.
// GET [?deleted=1] -> clients with login emails and rate. POST actions: create {name,email,hourly_rate?} ($19 default),
// update {id,name,email,hourly_rate?}, delete {id,confirm_name} (soft delete + revoke keys), restore {id},
// purge {id,confirm_name} (permanent; only for soft-deleted clients, via portal.hard_delete_client).
import { sessionEmail, isAdmin, portalConfigured, db, enc, badWrite, VALID_ID } from "@/libs/aiPortal/access";
import { DEFAULT_RATE } from "@/libs/aiPortal/tags";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "client";
const rateOf = (v) => (v == null || v === "" ? DEFAULT_RATE : Number(v));
const RATE_ERR = `Enter an hourly rate between $1 and $1,000, or leave it blank for $${DEFAULT_RATE}.`;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const email = await sessionEmail(req, res);
  if (!email) return res.status(401).json({ error: "Sign in required" });
  if (!isAdmin(email)) return res.status(403).json({ error: "Forbidden" });
  if (!portalConfigured()) return res.status(503).json({ error: "AI portal not configured" });
  try {
    if (req.method === "GET") {
      const showDeleted = req.query.deleted === "1";
      const clients = await db(`portal_clients?select=id,name,is_example,deleted_at,hourly_rate&deleted_at=${showDeleted ? "not.is.null" : "is.null"}&order=name`);
      const users = await db("portal_client_users?select=email,client_id");
      return res.status(200).json({ showDeleted, defaultRate: DEFAULT_RATE, clients: clients.map((c) => ({ ...c, emails: users.filter((u) => u.client_id === c.id).map((u) => u.email) })) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const bad = badWrite(req); if (bad) return res.status(bad[0]).json({ error: bad[1] });
    const b = req.body || {};
    if (b.action === "delete" || b.action === "restore" || b.action === "purge") {
      const id = String(b.id || "");
      const [c] = VALID_ID.test(id) ? await db(`portal_clients?id=eq.${enc(id)}&select=id,name,deleted_at`) : [];
      if (!c) return res.status(404).json({ error: "No such client" });
      if (b.action === "purge") {
        if (!c.deleted_at) return res.status(409).json({ error: "Only deleted clients can be deleted permanently. Delete the client first." });
        if (String(b.confirm_name || "").trim() !== c.name) return res.status(400).json({ error: "Type the client name exactly to confirm." });
        try { const counts = await db("rpc/hard_delete_client", { method: "POST", body: { p_id: id } }); return res.status(200).json({ ok: true, purged: id, counts }); }
        catch (x) { const m = / (\d{3})$/.exec(x.message || ""), st = m ? +m[1] : 500;
          if (st === 409) return res.status(409).json({ error: "Only deleted clients can be deleted permanently." });
          return res.status(500).json({ error: "Permanent delete failed. Nothing was removed." }); }
      }
      if (b.action === "delete") {
        if (String(b.confirm_name || "").trim() !== c.name) return res.status(400).json({ error: "Type the client name exactly to confirm." });
        if (!c.deleted_at) await db(`portal_clients?id=eq.${enc(id)}`, { method: "PATCH", body: { deleted_at: new Date().toISOString() } });
        await db(`portal_api_keys?client_id=eq.${enc(id)}&revoked_at=is.null`, { method: "PATCH", body: { revoked_at: new Date().toISOString() } });
        return res.status(200).json({ ok: true, deleted: id });
      }
      await db(`portal_clients?id=eq.${enc(id)}`, { method: "PATCH", body: { deleted_at: null } });
      return res.status(200).json({ ok: true, restored: id });
    }
    const name = String(b.name || "").trim().slice(0, 120), login = String(b.email || "").trim().toLowerCase().slice(0, 200);
    if (!name) return res.status(400).json({ error: "Enter a client name." });
    if (!EMAIL.test(login)) return res.status(400).json({ error: "Enter a valid login email." });
    const r = rateOf(b.hourly_rate);
    if (!(r > 0 && r <= 1000)) return res.status(400).json({ error: RATE_ERR });
    if (b.action === "create") {
      let id = slug(name), n = 1;
      while ((await db(`portal_clients?id=eq.${enc(id)}&select=id`)).length) id = `${slug(name).slice(0, 46)}-${++n}`;
      await db("portal_clients", { method: "POST", body: { id, name, hourly_rate: Math.round(r * 100) / 100, currency: "USD", timezone: "America/New_York" } });
      await db("portal_client_users", { method: "POST", body: { email: login, client_id: id } });
      return res.status(201).json({ ok: true, id });
    }
    if (b.action === "update") {
      const id = String(b.id || "");
      if (!VALID_ID.test(id) || !(await db(`portal_clients?id=eq.${enc(id)}&deleted_at=is.null&select=id`)).length) return res.status(404).json({ error: "No such client" });
      const patch = { name }; if (b.hourly_rate !== undefined) patch.hourly_rate = Math.round(r * 100) / 100;
      await db(`portal_clients?id=eq.${enc(id)}`, { method: "PATCH", body: patch });
      await db(`portal_client_users?client_id=eq.${enc(id)}&email=neq.${enc(login)}`, { method: "DELETE" });
      await db("portal_client_users?on_conflict=email,client_id", { method: "POST", body: { email: login, client_id: id }, prefer: "resolution=ignore-duplicates" });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("ai-portal admin failed:", e?.message);
    return res.status(500).json({ error: "That didn't work. Nothing was changed, or only partly; refresh and check." });
  }
}
