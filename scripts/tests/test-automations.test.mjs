import test from "node:test";
import assert from "node:assert/strict";
import { deleteTestAutomation } from "../../libs/aiPortal/testAutomations.js";

function fakeDb(autos, reports) {
  const calls = [];
  const db = async (path, opts = {}) => {
    calls.push([opts.method || "GET", path]);
    if ((opts.method || "GET") !== "GET") return null;
    if (path.startsWith("portal_automations")) return autos;
    if (path.startsWith("portal_reports")) return reports;
    return [];
  };
  return { db, calls };
}

test("deletes a logs- test automation, its reports and resolutions", async () => {
  const { db, calls } = fakeDb([{ automation_id: "logs-test", name: "Logs connection test" }], [{ report_id: "r1", counts: { test_reports_sent: 1 } }]);
  const r = await deleteTestAutomation(db, "acme", "logs-test");
  assert.equal(r.status, 200); assert.equal(r.reports, 1);
  const dels = calls.filter(([m]) => m === "DELETE").map(([, p]) => p.split("?")[0]);
  assert.deepEqual(dels, ["portal_issue_resolutions", "portal_reports", "portal_automations"]);
});

test("refuses a real client automation", async () => {
  const { db, calls } = fakeDb([{ automation_id: "lead-followup", name: "Lead follow-up" }], [{ report_id: "r1", counts: { leads_qualified: 3 } }]);
  const r = await deleteTestAutomation(db, "acme", "lead-followup");
  assert.equal(r.status, 409);
  assert.equal(calls.filter(([m]) => m === "DELETE").length, 0);
});

test("allows an automation whose every report is test-only counts", async () => {
  const { db } = fakeDb([], [{ report_id: "r1", counts: { connection_test: 1 } }]);
  assert.equal((await deleteTestAutomation(db, "acme", "zap-1")).status, 200);
});

test("404 when nothing exists, 400 on bad id", async () => {
  const { db } = fakeDb([], []);
  assert.equal((await deleteTestAutomation(db, "acme", "nope")).status, 404);
  assert.equal((await deleteTestAutomation(db, "acme", "bad id/..")).status, 400);
});
