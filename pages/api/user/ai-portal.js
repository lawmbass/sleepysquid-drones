// GET: the signed-in user's SleepySquid AI automation report (same data as ai.sleepysquid.com/portal).
// Clients only ever get their own client ids (mapped by sign-in email). Admins may pick any live client.
// Errors and test/connection automations are admin-only and are stripped for clients. Errors are generic.
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { adminConfig } from "@/libs/adminConfig";
import { db, activeClientIds, portalConfigured } from "@/libs/aiPortal/db";
import { buildReport } from "@/libs/aiPortal/report";

const DAY = 86400000, iso = (d) => d.toISOString().slice(0, 10);
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(Date.parse(s));
const enc = encodeURIComponent;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.toLowerCase();
  if (!email) return res.status(401).json({ error: "Sign in required" });
  if (!portalConfigured()) return res.status(200).json({ linked: false });
  try {
    const admin = adminConfig.isAdmin(email);
    let ids;
    if (admin) ids = (await db("portal_clients?deleted_at=is.null&select=id&order=name")).map((c) => c.id);
    else ids = await activeClientIds(email);
    if (!ids.length) return res.status(200).json({ linked: false, admin });
    const want = String(req.query.client || "");
    const clientId = ids.includes(want) ? want : ids[0];
    const clients = await db(`portal_clients?id=in.(${ids.map(enc).join(",")})&select=id,name&order=name`);
    const to = okDate(req.query.to) ? req.query.to : iso(new Date());
    const from = okDate(req.query.from) && req.query.from <= to ? req.query.from : iso(new Date(Date.parse(to) - 29 * DAY));
    const d = await buildReport(clientId, from, to);
    if (!admin) { d.attention = []; d.testAutomations = []; }
    if (req.query.summary) {
      return res.status(200).json({ linked: true, admin, summary: { clientName: d.client.name, currency: d.client.currency, from, to, dollars: d.totals.dollars, hours: d.totals.hours, reporting: d.reportingCount, collecting: !d.lastUpdated || !(d.totals.dollars > 0) } });
    }
    return res.status(200).json({ linked: true, admin, clients, clientId, d: JSON.parse(JSON.stringify(d)), today: iso(new Date()) });
  } catch (e) {
    console.error("ai-portal report failed:", e?.message);
    return res.status(500).json({ error: "We couldn't load your automation report right now. Please try again later." });
  }
}
