import { requireAdmin } from "@/libs/adminRequest";
import { publicClient, validateClient } from "@/libs/clients/core.mjs";
import { clientsReady, insertClient, listClients, updateClient } from "@/libs/db/clients";
import { isUniqueViolation } from "@/libs/db/shared";
import { aiLoginMap, linkUserToClient, loginsWithoutClient, syncAiPortal } from "@/libs/clients/logins";

export const NOT_MIGRATED = "Clients aren't set up yet: the clients merge migration hasn't been applied.";

// GET: all clients (archived included; the UI hides them by default) with Owed / Last invoice / AI logins,
//      plus client logins that have no client record yet (so they stay reachable).
// POST: create (optionally linking an existing client account: linkUserId). Saving never sends email;
//       inviting is a separate, confirmed click.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "POST"]);
  if (!session) return;
  if (!(await clientsReady())) return req.method === "GET" ? res.status(200).json({ success: true, data: { migrated: false, notice: NOT_MIGRATED, clients: [], logins: [] } }) : res.status(503).json({ error: "Not migrated", message: NOT_MIGRATED });
  try {
    if (req.method === "GET") {
      const { rows, agg } = await listClients();
      let ai = {};
      try { ai = await aiLoginMap(); } catch (x) { console.error("AI logins lookup failed:", x?.message); }
      let logins = [];
      try { logins = await loginsWithoutClient(rows); } catch (x) { console.error("Unlinked logins lookup failed:", x?.message); }
      return res.status(200).json({ success: true, data: { migrated: true, logins,
        clients: rows.map((r) => publicClient(r, { ...agg[r.id], aiLogins: ai[r.portal_client_id] || [] })) } });
    }
    const v = validateClient(req.body);
    if (!v.ok) return res.status(400).json({ error: "Invalid client", message: Object.values(v.errors)[0], fields: v.errors });
    let row = await insertClient(v.value);
    const linkUserId = String(req.body?.linkUserId || "");
    if (linkUserId) {
      const r = await linkUserToClient(row, linkUserId, session.user?.email || "admin");
      if (r.error) return res.status(r.error[0]).json({ error: "Can't link", message: `Client saved, but ${r.error[1].charAt(0).toLowerCase()}${r.error[1].slice(1)}` });
      row = r.row;
    }
    try { const p = await syncAiPortal(row); if (p) row = await updateClient(row.id, p); }
    catch (x) { console.error("AI portal create failed:", x?.message); return res.status(502).json({ error: "AI sync failed", message: "Client saved, but its AI report wasn't set up. Edit and save it again to retry." }); }
    return res.status(201).json({ success: true, data: { client: publicClient(row) } });
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: "Duplicate", message: "Another client already uses that email", fields: { email: "Already used by another client" } });
    console.error("Clients error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not save the client" });
  }
}
