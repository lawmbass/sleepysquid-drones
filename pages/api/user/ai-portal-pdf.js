// GET ?from&to[&client] -> the AI automation report as a PDF. Clients get only their own account; the PDF never
// includes errors or test/connection automations (same as ai.sleepysquid.com/api/portal/report).
import { sessionEmail, resolveClient, portalConfigured } from "@/libs/aiPortal/access";
import { buildReport } from "@/libs/aiPortal/report";
import { renderReportPdf } from "@/libs/aiPortal/reportPdf";
export const config = { api: { responseLimit: "8mb" } };
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(Date.parse(s));
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const email = await sessionEmail(req, res);
  if (!email) return res.status(401).json({ error: "Sign in required" });
  if (!portalConfigured()) return res.status(404).json({ error: "Not found" });
  try {
    const c = await resolveClient(email, req.query.client);
    if (!c.clientId) return res.status(404).json({ error: "Not found" });
    const today = new Date().toISOString().slice(0, 10);
    const to = okDate(req.query.to) ? req.query.to : today;
    const from = okDate(req.query.from) && req.query.from <= to ? req.query.from : new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10);
    const d = await buildReport(c.clientId, from, to);
    d.attention = []; d.testAutomations = [];
    const pdf = await renderReportPdf(d);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sleepysquid-report-${c.clientId}-${from}_${to}.pdf"`);
    return res.end(pdf);
  } catch (e) {
    console.error("ai-portal pdf failed:", e?.message);
    return res.status(500).json({ error: "We couldn't create your PDF right now. Please try again later." });
  }
}
