// Admin-only removal of connection tests / setup checks ("Test automations" box on the AI dashboard).
// Runs portal.delete_test_automation() (supabase/portal_013_delete_test_automation.sql), which refuses anything
// that isn't a test and is the only way past the append-only trigger on portal.reports for a live client.
// It deletes, in one transaction: issue resolutions for its reports, its reports, then the automation row.
export const VALID_AUTOMATION_ID = /^[A-Za-z0-9._:-]{1,120}$/;

export async function deleteTestAutomation(db, clientId, automationId) {
  if (!VALID_AUTOMATION_ID.test(automationId || "")) return { status: 400, error: "Bad automation id" };
  try {
    const counts = await db("rpc/delete_test_automation", { method: "POST", body: { p_client: clientId, p_automation: automationId } });
    return { status: 200, ok: true, deleted: automationId, counts };
  } catch (x) {
    const m = / (\d{3})$/.exec(x?.message || ""), st = m ? +m[1] : 500;
    if (st === 404) return { status: 404, error: "No such test automation" };
    if (st === 409) return { status: 409, error: "Only test automations can be deleted here." };
    throw x;
  }
}
