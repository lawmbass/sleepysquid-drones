import { requireAdmin } from "@/libs/adminRequest";
import { publicClient, validateClient } from "@/libs/clients/core.mjs";
import { clientsReady, insertClient, listClients } from "@/libs/db/clients";
import { isUniqueViolation } from "@/libs/db/shared";

export const NOT_MIGRATED = "Clients aren't set up yet: the clients merge migration hasn't been applied.";

// GET: all clients (archived included; the UI hides them by default) with Owed / Last invoice.
// POST: create. Saving never sends email; inviting is a separate, confirmed click.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "POST"]);
  if (!session) return;
  if (!(await clientsReady())) return req.method === "GET" ? res.status(200).json({ success: true, data: { migrated: false, notice: NOT_MIGRATED, clients: [] } }) : res.status(503).json({ error: "Not migrated", message: NOT_MIGRATED });
  try {
    if (req.method === "GET") {
      const { rows, agg } = await listClients();
      return res.status(200).json({ success: true, data: { migrated: true, clients: rows.map((r) => publicClient(r, agg[r.id])) } });
    }
    const v = validateClient(req.body);
    if (!v.ok) return res.status(400).json({ error: "Invalid client", message: Object.values(v.errors)[0], fields: v.errors });
    const row = await insertClient(v.value);
    return res.status(201).json({ success: true, data: { client: publicClient(row) } });
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: "Duplicate", message: "Another client already uses that email", fields: { email: "Already used by another client" } });
    console.error("Clients error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not save the client" });
  }
}
