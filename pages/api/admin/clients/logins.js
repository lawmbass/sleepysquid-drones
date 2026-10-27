import { requireAdmin } from "@/libs/adminRequest";
import { clientsReady } from "@/libs/db/clients";
import { removeUserLogin } from "@/libs/clients/logins";

// POST {action:'remove', userId}: turn off a client account that has no client record. No email.
export default async function handler(req, res) {
  const session = await requireAdmin(req, res, ["POST"]);
  if (!session) return;
  if (!(await clientsReady())) return res.status(503).json({ error: "Not migrated" });
  if (req.body?.action !== "remove") return res.status(400).json({ error: "Invalid action" });
  try {
    const r = await removeUserLogin(String(req.body?.userId || ""), session.user?.email || "admin");
    if (r.error) return res.status(r.error[0]).json({ error: "Can't remove", message: r.error[1] });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Remove login error:", error?.message);
    return res.status(500).json({ error: "Server error", message: "Could not remove the login" });
  }
}
