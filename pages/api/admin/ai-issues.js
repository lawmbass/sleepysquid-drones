// POST (admin only): resolve / dismiss / reopen "Bot reports" items, or clear all open notes for a client.
// Body: { client, action: "resolve"|"dismiss"|"reopen"|"clear_notes", ids?: [issue ids], from?, to? }
// Ids are checked against the client's own report items, so arbitrary ids can't be written. Never deletes anything.
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { portalConfigured } from "@/libs/aiPortal/db";
import { buildReport } from "@/libs/aiPortal/report";
import { setResolution } from "@/libs/aiPortal/issues";

const ACTIONS = new Set(["resolve", "dismiss", "reopen", "clear_notes"]);
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email || !adminConfig.isAdmin(email)) return res.status(403).json({ error: "Admins only" });
  if (!portalConfigured()) return res.status(503).json({ error: "Not configured" });
  const { client, action, ids = [], from, to } = req.body || {};
  if (!client || !ACTIONS.has(action) || !Array.isArray(ids) || ids.length > 500) return res.status(400).json({ error: "Bad request" });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const d = await buildReport(String(client), okDate(from) ? from : "2000-01-01", okDate(to) ? to : today);
    if (!d.resolutionsAvailable) return res.status(503).json({ error: "Resolving isn't switched on yet (database update pending)." });
    const all = [...d.attention, ...d.issueNotes, ...d.resolvedIssues];
    const want = action === "clear_notes" ? d.issueNotes : all.filter((x) => ids.includes(x.id));
    const n = await setResolution({ clientId: d.client.id, items: want, action, by: email });
    return res.status(200).json({ ok: true, updated: n });
  } catch (e) {
    console.error("ai-issues failed:", e?.message);
    return res.status(500).json({ error: "Couldn't save that change. Please try again." });
  }
}
