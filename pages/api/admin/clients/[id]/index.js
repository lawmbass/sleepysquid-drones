import { requireAdmin } from "@/libs/adminRequest";
import { publicClient, validateClient } from "@/libs/clients/core.mjs";
import { clientsReady, getClient, updateClient } from "@/libs/db/clients";
import { isUniqueViolation } from "@/libs/db/shared";

// GET one client; PATCH fields; POST {action: archive|unarchive|revoke}. Archive keeps invoices.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "PATCH", "POST"]);
  if (!session) return;
  if (!(await clientsReady())) return res.status(503).json({ error: "Not migrated" });
  const c = await getClient(String(req.query.id || ""));
  if (!c) return res.status(404).json({ error: "Not found", message: "Client not found" });
  try {
    if (req.method === "GET") return res.status(200).json({ success: true, data: { client: publicClient(c) } });
    if (req.method === "PATCH") {
      const v = validateClient(req.body);
      if (!v.ok) return res.status(400).json({ error: "Invalid client", message: Object.values(v.errors)[0], fields: v.errors });
      return res.status(200).json({ success: true, data: { client: publicClient(await updateClient(c.id, v.value)) } });
    }
    const action = String(req.body?.action || "");
    const patch = action === "archive" ? { archived_at: new Date().toISOString() } : action === "unarchive" ? { archived_at: null }
      : action === "revoke" ? { user_id: null, invited_at: null } : null;   // revoke: unlinks the login; the user account itself stays
    if (!patch) return res.status(400).json({ error: "Invalid action" });
    return res.status(200).json({ success: true, data: { client: publicClient(await updateClient(c.id, patch)) } });
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: "Duplicate", message: "Another client already uses that email", fields: { email: "Already used by another client" } });
    console.error("Client error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not update the client" });
  }
}
