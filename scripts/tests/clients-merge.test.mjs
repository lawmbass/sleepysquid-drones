import { test } from "node:test";
import assert from "node:assert/strict";
import { planClientsMerge } from "../../libs/clients/merge.mjs";

// Same data as scripts/pg/clients-merge.fixture.sql, so the planner and the SQL migration must agree.
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const fixture = {
  users: [
    { id: U(1), name: "Lawrence", email: "lawrence@sleepysquid.com", role: "admin" },
    { id: U(2), name: "Verify Test", email: "Verify@Example.com", role: "client" },
    { id: U(3), name: "Bo", email: "bo@acme.com", role: "client", company: "Acme Roofing" },
    { id: U(4), name: "Pi", email: "pilot@x.com", role: "pilot" },
    { id: U(5), name: "Cy", email: "cy@twin.com", role: "client", company: "Twin" },
    { id: U(6), name: "Di", email: "di@twin.com", role: "client", company: "Twin" },
  ],
  aiClients: [
    { id: "alpha", name: "Alpha And Omega Solutions", hourly_rate: 19 },
    { id: "acme", name: "Acme AI", hourly_rate: 25 },
    { id: "twin", name: "Twin", hourly_rate: 30 },
    { id: "demo", name: "Demo Co", hourly_rate: 10, is_example: true },
    { id: "gone", name: "Gone LLC", hourly_rate: 15, deleted_at: "2026-10-01T00:00:00Z" },
  ],
  aiClientUsers: [{ client_id: "alpha", email: "admin@alphaandomegasolutions.org" }, { client_id: "acme", email: "BO@acme.com" }, { client_id: "gone", email: "x@gone.com" }],
  invoices: [{ id: "i1", user_id: U(3) }, { id: "i2", ai_client_id: "alpha" }, { id: "i3", recipient_email: "one@time.com" }, { id: "i4", ai_client_id: "acme" }],
};

test("planner matches the SQL migration on the fixture", () => {
  const p = planClientsMerge(fixture);
  assert.equal(p.counts.clients, 7);
  assert.equal(p.counts.merged, 1);
  assert.deepEqual(p.counts.skipped, { admins: 1, staffEmail: 0, pilots: 1, exampleAi: 1 });
  const alpha = p.clients.find((c) => c.portal_client_id === "alpha");
  assert.deepEqual([alpha.business_name, alpha.hourly_rate, alpha.portal, alpha.services], ["Alpha And Omega Solutions", 19, "No login", ["ai"]]);
  const acme = p.clients.find((c) => c.portal_client_id === "acme");
  assert.deepEqual([acme.business_name, acme.user_id, acme.portal, acme.services.sort()], ["Acme Roofing", U(3), "Has login", ["ai", "drones"]]);
  assert.ok(p.clients.find((c) => c.portal_client_id === "gone").archived_at);
  assert.ok(!p.clients.some((c) => c.email?.endsWith("@sleepysquid.com")));
  assert.equal(new Set(p.clients.map((c) => c.email).filter(Boolean)).size, p.clients.filter((c) => c.email).length);
  const kinds = p.flagged.map((f) => f.kind);
  assert.ok(kinds.includes("ambiguous") && kinds.includes("business-name-derived") && kinds.includes("name-differs"));
  assert.equal(p.counts.invoicesRepointed, 3);
  assert.equal(p.counts.invoicesOneTime, 1);
  assert.equal(p.invoices.find((i) => i.invoiceId === "i4").to, `user:${U(3)}`);
});

test("unresolved invoices and duplicate emails are flagged", () => {
  const p = planClientsMerge({
    users: [{ id: "a", email: "same@x.com", role: "client", company: "A" }],
    aiClients: [{ id: "b", name: "B" }, { id: "c", name: "C" }],
    aiClientUsers: [{ client_id: "b", email: "b@x.com" }, { client_id: "c", email: "b@x.com" }],
    invoices: [{ id: "z", user_id: "admin-id" }],
  });
  assert.ok(p.flagged.some((f) => f.kind === "invoice-unresolved"));
  assert.ok(p.flagged.some((f) => f.kind === "duplicate-email"));
  assert.equal(p.clients.filter((c) => c.email === "b@x.com").length, 1);
});
