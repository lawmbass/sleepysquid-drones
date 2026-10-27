import { requireAdmin } from "@/libs/adminRequest";
import { publicClient, validateClient } from "@/libs/clients/core.mjs";
import { clientsReady, getClient, updateClient } from "@/libs/db/clients";
import { isUniqueViolation } from "@/libs/db/shared";
import { aiLoginsFor, archiveAiPortal, linkUserToClient, purgeAiPortal, removeClientLogin, syncAiPortal } from "@/libs/clients/logins";

// GET one client; PATCH fields; POST {action}:
//   archive | unarchive          – archive keeps invoices; for AI clients it also stops the AI login and revokes API keys (unarchive restores)
//   remove-login (alias revoke)  – removes the portal login (account link + AI report login); the client row stays
//   link-user {userId}           – link an existing client account to this client (no email)
//   purge-ai {confirmName}       – archived AI clients only: permanently erase their AI portal data; the client row stays
// Nothing here sends email.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["GET", "PATCH", "POST"]);
  if (!session) return;
  if (!(await clientsReady())) return res.status(503).json({ error: "Not migrated" });
  const c = await getClient(String(req.query.id || ""));
  if (!c) return res.status(404).json({ error: "Not found", message: "Client not found" });
  const out = async (row, extra = {}) => res.status(200).json({ success: true, data: { client: publicClient(row, { aiLogins: await aiLoginsFor(row.portal_client_id).catch(() => []) }), ...extra } });
  const actor = session.user?.email || "admin";
  try {
    if (req.method === "GET") return out(c);
    if (req.method === "PATCH") {
      const v = validateClient(req.body);
      if (!v.ok) return res.status(400).json({ error: "Invalid client", message: Object.values(v.errors)[0], fields: v.errors });
      let row = await updateClient(c.id, v.value);
      try { const p = await syncAiPortal(row, c); if (p) row = await updateClient(c.id, p); }
      catch (x) { console.error("AI portal sync failed:", x?.message); return res.status(502).json({ error: "AI sync failed", message: "Client saved, but the AI report settings weren't updated. Try saving again." }); }
      return out(row);
    }
    const action = String(req.body?.action || "");
    if (action === "archive" || action === "unarchive") {
      const row = await updateClient(c.id, { archived_at: action === "archive" ? new Date().toISOString() : null });
      await archiveAiPortal(row, action === "archive");
      return out(row);
    }
    if (action === "remove-login" || action === "revoke") return out(await removeClientLogin(c, actor));
    if (action === "link-user") {
      const r = await linkUserToClient(c, String(req.body?.userId || ""), actor);
      if (r.error) return res.status(r.error[0]).json({ error: "Can't link", message: r.error[1] });
      return out(r.row);
    }
    if (action === "purge-ai") {
      if (!c.archived_at || !c.portal_client_id) return res.status(409).json({ error: "Not allowed", message: "Archive the client first. Only archived AI clients can have their AI data deleted." });
      if (String(req.body?.confirmName || "").trim() !== c.business_name) return res.status(400).json({ error: "Confirm required", message: "Type the business name exactly to confirm." });
      const r = await purgeAiPortal(c);
      return out(r?.row || c, { counts: r?.counts || null });
    }
    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: "Duplicate", message: "Another client already uses that email", fields: { email: "Already used by another client" } });
    console.error("Client error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not update the client" });
  }
}
