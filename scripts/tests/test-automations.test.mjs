import test from "node:test";
import assert from "node:assert/strict";
import { deleteTestAutomation } from "../../libs/aiPortal/testAutomations.js";

const dbReturning = (fn) => { const calls = []; return { calls, db: async (p, o = {}) => { calls.push([o.method || "GET", p, o.body]); return fn(p); } }; };

test("calls the delete_test_automation RPC and returns its counts", async () => {
  const { db, calls } = dbReturning(() => ({ issue_resolutions: 0, reports: 1, automations: 1 }));
  const r = await deleteTestAutomation(db, "acme", "logs-test");
  assert.equal(r.status, 200); assert.deepEqual(r.counts, { issue_resolutions: 0, reports: 1, automations: 1 });
  assert.deepEqual(calls, [["POST", "rpc/delete_test_automation", { p_client: "acme", p_automation: "logs-test" }]]);
});

test("maps RPC 409 (not a test) and 404 (missing)", async () => {
  for (const [st, want] of [[409, 409], [404, 404]]) {
    const { db } = dbReturning(() => { throw new Error(`portal db POST rpc/delete_test_automation ${st}`); });
    assert.equal((await deleteTestAutomation(db, "acme", "lead-followup")).status, want);
  }
});

test("other errors throw; bad id never reaches the db", async () => {
  const { db } = dbReturning(() => { throw new Error("portal db POST rpc/delete_test_automation 500"); });
  await assert.rejects(deleteTestAutomation(db, "acme", "logs-test"));
  const s = dbReturning(() => null);
  assert.equal((await deleteTestAutomation(s.db, "acme", "bad id/..")).status, 400);
  assert.equal(s.calls.length, 0);
});
