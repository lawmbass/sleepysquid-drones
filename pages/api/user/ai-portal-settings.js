// AI automation Settings (replaces ai.sleepysquid.com /portal/settings, /api/portal/rate, /api/portal/keys).
// GET [?client] -> rate + API key status. POST {client, action:"rate", hourly_wage|null} or {client, action:"rotate"}.
// Writes are for the client themself; admins get a read-only view (same rule as the old admin preview).
import crypto from "crypto";
import { sessionEmail, resolveClient, portalConfigured, db, enc, badWrite, keyInfo } from "@/libs/aiPortal/access";
const GENERIC = "We couldn't save that right now. Please try again later.";
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const email = await sessionEmail(req, res);
  if (!email) return res.status(401).json({ error: "Sign in required" });
  if (!portalConfigured()) return res.status(200).json({ linked: false });
  try {
    if (req.method === "GET") {
      const c = await resolveClient(email, req.query.client);
      if (!c.clientId) return res.status(200).json({ linked: false, admin: c.admin });
      const [client] = await db(`portal_clients?id=eq.${enc(c.clientId)}&select=id,name,hourly_rate,is_example`);
      const ov = await db(`portal_rate_overrides?client_id=eq.${enc(c.clientId)}&select=hourly_wage`);
      const mine = ov.length && ov.every((o) => o.hourly_wage != null && o.hourly_wage === ov[0].hourly_wage) ? ov[0].hourly_wage : null;
      const clients = await db(`portal_clients?id=in.(${c.ids.map(enc).join(",")})&select=id,name&order=name`);
      return res.status(200).json({ linked: true, admin: c.admin, readOnly: c.admin, clients, client, mine, keyInfo: await keyInfo(c.clientId) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const bad = badWrite(req); if (bad) return res.status(bad[0]).json({ error: bad[1] });
    const b = req.body || {};
    const c = await resolveClient(email, b.client);
    if (c.admin) return res.status(403).json({ error: "Read only: admins manage clients under Manage AI clients." });
    if (!c.clientId) return res.status(403).json({ error: "No client account" });
    if (b.client && !c.ids.includes(String(b.client))) return res.status(404).json({ error: "No such client" });
    const clientId = c.clientId;
    if (b.action === "rotate") {
      const key = "ssk_" + crypto.randomBytes(24).toString("base64url"), now = new Date();
      const [row] = await db("portal_api_keys?select=expires_at", { method: "POST", prefer: "return=representation",
        body: { key_hash: sha256(key), client_id: clientId, label: `rotated by ${email}`, expires_at: new Date(now.getTime() + 90 * 86400000).toISOString() } });
      await db(`portal_api_keys?client_id=eq.${enc(clientId)}&revoked_at=is.null&key_hash=neq.${sha256(key)}`, { method: "PATCH", body: { revoked_at: now.toISOString() } });
      return res.status(201).json({ ok: true, key, expires_at: row.expires_at });
    }
    if (b.action !== "rate") return res.status(400).json({ error: "Bad request" });
    const [client] = await db(`portal_clients?id=eq.${enc(clientId)}&select=business_type`);
    const wts = [...new Set((await db(`portal_metric_catalog?business_type=eq.${enc(client.business_type)}&savable=is.true&select=workflow_type`)).map((r) => r.workflow_type))];
    if (b.hourly_wage === null) {
      await db(`portal_rate_overrides?client_id=eq.${enc(clientId)}&minutes_per_unit=is.null`, { method: "DELETE" });
      await db(`portal_rate_overrides?client_id=eq.${enc(clientId)}`, { method: "PATCH", body: { hourly_wage: null } });
      return res.status(200).json({ ok: true });
    }
    const w = Number(b.hourly_wage);
    if (!(w > 0 && w <= 1000)) return res.status(400).json({ error: "Enter an hourly rate between $1 and $1,000." });
    if (wts.length) await db("portal_rate_overrides?on_conflict=client_id,workflow_type", { method: "POST", prefer: "resolution=merge-duplicates",
      body: wts.map((wt) => ({ client_id: clientId, workflow_type: wt, hourly_wage: Math.round(w * 100) / 100, source: "CLIENT ACTUAL", note: `set in dashboard by ${email}`, updated_at: new Date().toISOString() })) });
    await db(`portal_clients?id=eq.${enc(clientId)}`, { method: "PATCH", body: { hourly_rate: Math.round(w * 100) / 100 } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("ai-portal settings failed:", e?.message);
    return res.status(500).json({ error: req.method === "GET" ? "We couldn't load your settings right now. Please try again later." : GENERIC });
  }
}
