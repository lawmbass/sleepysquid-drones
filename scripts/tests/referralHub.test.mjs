import test from "node:test";
import assert from "node:assert/strict";
import { approvePayout, approveRequest, attributeCode, claimEvent, createReferrer, invoiceQualifies, lineIsReferralEligible, recordEligiblePayment, submitRequest } from "../../libs/referralHub.mjs";

function fakeDb(seed = {}) {
  const tables = {
    portal_referrers: seed.referrers || [],
    portal_referral_requests: seed.requests || [],
    portal_referrals: seed.referrals || [],
    portal_referral_payouts: seed.payouts || [],
    portal_referral_events: [],
  };
  return async function db(path, { method = "GET", body, prefer } = {}) {
    const q = path.indexOf("?");
    const table = q === -1 ? path : path.slice(0, q);
    const params = new URLSearchParams(q === -1 ? "" : path.slice(q + 1));
    const onConflict = params.get("on_conflict");
    const filters = [];
    for (const [field, raw] of params) {
      if (field === "on_conflict" || field === "select") continue;
      const match = /^(eq|is)\.(.*)$/.exec(raw);
      if (!match) continue;
      filters.push({ field, op: match[1], value: match[2] });
    }
    const rows = tables[table];
    const hit = () => rows.filter((row) => filters.every((filter) => filter.op === "eq" ? String(row[filter.field]) === filter.value : filter.value === "null" ? row[filter.field] == null : false));
    if (method === "GET") return hit().map((row) => structuredClone(row));
    if (method === "PATCH") {
      const found = hit();
      for (const row of found) Object.assign(row, structuredClone(body));
      return prefer?.includes("return=representation") ? found.map((row) => structuredClone(row)) : null;
    }
    const incoming = structuredClone(body);
    if (onConflict && rows.some((row) => row[onConflict] === incoming[onConflict]) && prefer?.includes("ignore-duplicates")) return [];
    rows.push(incoming);
    return prefer?.includes("return=representation") ? [structuredClone(incoming)] : null;
  };
}

test("web build lines qualify and care lines do not", () => {
  assert.equal(lineIsReferralEligible({ service: "web", referral_eligible: "true" }), true);
  assert.equal(lineIsReferralEligible({ service: "web", referral_eligible: "false" }), false);
  assert.equal(lineIsReferralEligible({ service: "ai" }), true);
});

test("invoice.paid before checkout and the reverse create one fee", async () => {
  const db = fakeDb();
  const referrer = await createReferrer(db, { name: "Mike Example", email: "mike.example@example.test" });
  assert.match(referrer.code, /^mike\d{4}$/);
  const invoice = { id: "in_build", status: "paid", amount_paid: 250000, lines: { data: [{ pricing: { price_details: { product: "prod_rebuild" } } }] } };
  const products = async (id) => ({ id, metadata: { service: "web", referral_eligible: "true" } });
  assert.equal(await claimEvent(db, "evt_invoice", "invoice.paid"), true);
  assert.equal(await claimEvent(db, "evt_invoice", "invoice.paid"), false);
  await attributeCode(db, { code: referrer.code, customerId: "cus_buyer", email: "buyer.example@example.test", businessLine: "webdev" });
  const first = await recordEligiblePayment(db, { customerId: "cus_buyer", email: "buyer.example@example.test", invoiceId: "in_build", invoice, retrieveProduct: products });
  assert.equal(first.created, true);
  const again = await recordEligiblePayment(db, { customerId: "cus_buyer", email: "buyer.example@example.test", invoiceId: "in_build", invoice, retrieveProduct: products });
  assert.equal(again.created, false);
  const care = { lines: { data: [{ pricing: { price_details: { product: "prod_care" } } }] } };
  assert.equal(await invoiceQualifies(care, async () => ({ metadata: { service: "web", referral_eligible: "false" } })), false);
});

test("checkout before invoice still pays once, and a live key does not transfer", async () => {
  const db = fakeDb();
  const referrer = await createReferrer(db, { name: "Riley Example", email: "riley.example@example.test" });
  await attributeCode(db, { code: referrer.code, customerId: "cus_b", email: "buyer2.example@example.test" });
  const invoice = { lines: { data: [{ price: { product: { metadata: { service: "drones" } } } }] } };
  const paid = await recordEligiblePayment(db, { customerId: "cus_b", invoiceId: "in_2", invoice, retrieveProduct: async () => ({}) });
  assert.equal(paid.created, true);
  const blocked = await approvePayout(db, { payoutId: paid.payout.id, testMode: false, stripeTransfer: async () => { throw new Error("should not transfer"); } });
  assert.equal(blocked.transferred, false);
  assert.equal(blocked.status, "approved_awaiting_onboarding");
});

test("approving a request creates one code", async () => {
  const db = fakeDb();
  const submitted = await submitRequest(db, { name: "Avery Example", email: "avery.example@example.test", note: "Neighbor" });
  assert.equal(submitted.duplicate, false);
  const again = await submitRequest(db, { name: "Avery Example", email: "avery.example@example.test", note: "again" });
  assert.equal(again.duplicate, true);
  const approved = await approveRequest(db, submitted.request.id);
  assert.match(approved.referrer.code, /^avery\d{4}$/);
});
