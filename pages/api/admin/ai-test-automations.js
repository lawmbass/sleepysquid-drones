// POST (admin only): { client, automation_id } -> permanently delete a test automation and its test reports.
// Refuses anything that isn't a test automation (see libs/aiPortal/testAutomations).
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { db, portalConfigured } from "@/libs/aiPortal/db";
import { badWrite, VALID_ID } from "@/libs/aiPortal/access";
import { deleteTestAutomation } from "@/libs/aiPortal/testAutomations";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !adminConfig.isAdmin(email)) return res.status(403).json({ error: "Admins only" });
  if (!portalConfigured()) return res.status(503).json({ error: "Not configured" });
  const bad = badWrite(req); if (bad) return res.status(bad[0]).json({ error: bad[1] });
  const { client, automation_id } = req.body || {};
  if (!VALID_ID.test(String(client || ""))) return res.status(400).json({ error: "Bad request" });
  try {
    const r = await deleteTestAutomation(db, String(client), String(automation_id || ""));
    const { status, ...body } = r;
    return res.status(status).json(body);
  } catch (e) {
    console.error("ai-test-automations failed:", e?.message);
    return res.status(500).json({ error: "Couldn't delete that. Refresh and check." });
  }
}
