// Admin-only removal of connection tests / setup checks ("Test automations" box on the AI dashboard).
// Only deletes an automation that is a test (isInternalAutomation) or whose every report is test-only counts,
// so a real client automation can never be removed this way. Deletes, in order: issue resolutions for its
// reports, its reports, then the automation row (if one exists).
import { isInternalAutomation, isTestCounts } from "./tags.js";

const enc = encodeURIComponent;
export const VALID_AUTOMATION_ID = /^[A-Za-z0-9._:-]{1,120}$/;

export async function deleteTestAutomation(db, clientId, automationId) {
  if (!VALID_AUTOMATION_ID.test(automationId || "")) return { status: 400, error: "Bad automation id" };
  const c = enc(clientId), a = enc(automationId);
  const autos = await db(`portal_automations?client_id=eq.${c}&automation_id=eq.${a}&select=*`);
  const reports = await db(`portal_reports?client_id=eq.${c}&automation_id=eq.${a}&select=report_id,counts`);
  if (!autos.length && !reports.length) return { status: 404, error: "No such test automation" };
  const isTest = isInternalAutomation(autos[0] || { automation_id: automationId }) || (reports.length > 0 && reports.every((r) => isTestCounts(r.counts)));
  if (!isTest) return { status: 409, error: "Only test automations can be deleted here." };
  const ids = reports.map((r) => r.report_id);
  if (ids.length) await db(`portal_issue_resolutions?client_id=eq.${c}&report_id=in.(${ids.map(enc).join(",")})`, { method: "DELETE" });
  if (ids.length) await db(`portal_reports?client_id=eq.${c}&automation_id=eq.${a}`, { method: "DELETE" });
  if (autos.length) await db(`portal_automations?client_id=eq.${c}&automation_id=eq.${a}`, { method: "DELETE" });
  return { status: 200, ok: true, deleted: automationId, reports: ids.length };
}
