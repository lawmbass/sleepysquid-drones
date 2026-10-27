import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canDeleteInvoice, deleteInvoiceFlow, shouldApplyWebhook, DELETABLE_STATUSES } from "../../libs/invoicing/core.mjs";

function deps(stripeInv, extra = {}) {
  const log = [];
  return {
    log,
    getStripeInvoice: async (id) => { log.push(["get", id]); if (stripeInv instanceof Error) throw stripeInv; return stripeInv; },
    deleteStripeDraft: async (id) => log.push(["stripeDelete", id]),
    deleteRow: async (id) => log.push(["rowDelete", id]),
    writeAudit: async (a) => log.push(["audit", a.action, a.stripeInvoiceId, a.actorEmail]),
    actorEmail: "admin@x.com",
    ...extra,
  };
}
const row = (status) => ({ id: "11111111-1111-1111-1111-111111111111", stripe_invoice_id: "in_1", status, total_cents: 0, currency: "usd", livemode: true });

test("only void and draft are deletable", () => {
  assert.deepEqual(DELETABLE_STATUSES, ["void", "draft"]);
  for (const s of ["open", "paid", "uncollectible", "deleted"]) assert.equal(canDeleteInvoice(row(s)), false, s);
  assert.equal(canDeleteInvoice(null), false);
});

test("refuses other statuses server-side without touching Stripe or the DB", async () => {
  for (const s of ["open", "paid", "uncollectible"]) {
    const d = deps({ status: s });
    const r = await deleteInvoiceFlow(row(s), d);
    assert.equal(r.ok, false); assert.equal(r.status, 409); assert.deepEqual(d.log, []);
  }
  assert.equal((await deleteInvoiceFlow(null, deps({}))).status, 404);
});

test("void: audit then DB delete, Stripe untouched", async () => {
  const d = deps({ status: "void" });
  const r = await deleteInvoiceFlow(row("void"), d);
  assert.equal(r.ok, true); assert.equal(r.stripeDraftDeleted, false);
  assert.deepEqual(d.log, [["audit", "delete", "in_1", "admin@x.com"], ["rowDelete", row("void").id]]);
});

test("draft: deletes Stripe draft, audits, removes row", async () => {
  const d = deps({ status: "draft" });
  const r = await deleteInvoiceFlow(row("draft"), d);
  assert.equal(r.stripeDraftDeleted, true);
  assert.deepEqual(d.log.map((l) => l[0]), ["get", "stripeDelete", "audit", "rowDelete"]);
});

test("draft already gone in Stripe still removes row; finalized in Stripe is refused", async () => {
  const gone = Object.assign(new Error("nf"), { status: 404 });
  const d = deps(gone);
  assert.equal((await deleteInvoiceFlow(row("draft"), d)).ok, true);
  assert.ok(!d.log.some((l) => l[0] === "stripeDelete"));
  const d2 = deps({ status: "open" });
  const r2 = await deleteInvoiceFlow(row("draft"), d2);
  assert.equal(r2.status, 409); assert.ok(!d2.log.some((l) => l[0] === "rowDelete"));
});

test("draft with Stripe writes disabled is refused", async () => {
  const d = deps({ status: "draft" }, { stripeWritesAllowed: false });
  assert.equal((await deleteInvoiceFlow(row("draft"), d)).status, 403);
  assert.ok(!d.log.some((l) => l[0] === "rowDelete"));
});

test("audit failure means no delete", async () => {
  const d = deps({ status: "void" }, { writeAudit: async () => { throw new Error("check violation"); } });
  await assert.rejects(() => deleteInvoiceFlow(row("void"), d));
  assert.ok(!d.log.some((l) => l[0] === "rowDelete"));
});

test("webhook guard skips deleted/missing invoices", () => {
  assert.equal(shouldApplyWebhook(null), false);
  assert.equal(shouldApplyWebhook({ status: "deleted" }), false);
  assert.equal(shouldApplyWebhook({ status: "void" }), true);
  const src = fs.readFileSync(new URL("../../pages/api/webhooks/stripe-invoices.js", import.meta.url), "utf8");
  assert.match(src, /shouldApplyWebhook\(existing\)/);
  assert.doesNotMatch(src, /insertInvoice|upsert/);
});

test("DELETE route is admin-gated, DELETE-only, and confirm-checked", () => {
  const src = fs.readFileSync(new URL("../../pages/api/admin/invoicing/invoices/[id]/index.js", import.meta.url), "utf8");
  assert.match(src, /requireAdmin\(req, res, \[[^\]]*"DELETE"\]\)/);
  assert.match(src, /confirm !== "DELETE"/);
  assert.match(src, /deleteInvoiceFlow/);
});

test("migration allows the delete audit action", () => {
  const sql = fs.readFileSync(new URL("../../supabase/migrations/20261027014500_invoice_delete_audit.sql", import.meta.url), "utf8");
  assert.match(sql, /'delete'/);
});
