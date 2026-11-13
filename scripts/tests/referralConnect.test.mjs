import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { attributeCode, approvePayout, createReferrer, recordEligiblePayment } from "../../libs/referralHub.mjs";
import { runReferralAdmin } from "../../libs/referralAdmin.mjs";

function read(file) {
  return fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
}

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
      filters.push({ field, op: match[1], value: decodeURIComponent(match[2]) });
    }
    const rows = tables[table];
    const hit = () => rows.filter((row) => filters.every((filter) => filter.op === "eq" ? String(row[filter.field]) === filter.value : row[filter.field] == null));
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

async function readyPayout() {
  const db = fakeDb();
  const referrer = await createReferrer(db, { name: "Mike Example", email: "mike.example@example.test" });
  await db(`portal_referrers?id=eq.${referrer.id}`, { method: "PATCH", body: { stripe_account_id: "acct_test_mike", payouts_enabled: true } });
  await attributeCode(db, { code: referrer.code, customerId: "cus_b", email: "buyer.example@example.test" });
  const invoice = { lines: { data: [{ price: { product: { metadata: { service: "drones" } } } }] } };
  const paid = await recordEligiblePayment(db, { customerId: "cus_b", invoiceId: "in_1", invoice, retrieveProduct: async () => ({}) });
  return { db, referrer, payout: paid.payout };
}

test("approve sends one transfer only when payouts are set up", async () => {
  const { db, payout } = await readyPayout();
  const calls = [];
  const stripeTransfer = async (params, key) => {
    calls.push({ params, key });
    return { id: "tr_test_1" };
  };
  const sent = await approvePayout(db, { payoutId: payout.id, stripeTransfer, connectConfigured: true });
  assert.equal(sent.transferred, true);
  assert.equal(sent.transferId, "tr_test_1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.amount, 20000);
  assert.equal(calls[0].params.destination, "acct_test_mike");
  assert.equal(calls[0].key, `referral_${payout.referral_id}`);
  const again = await approvePayout(db, { payoutId: payout.id, stripeTransfer, connectConfigured: true });
  assert.equal(again.already, true);
  assert.equal(calls.length, 1);
  const [row] = await db(`portal_referral_payouts?id=eq.${payout.id}&select=*`);
  assert.equal(row.status, "paid");
  assert.equal(row.stripe_transfer_id, "tr_test_1");
});

test("approve stays manual when payouts are not set up or the connect key is missing", async () => {
  const { db, payout } = await readyPayout();
  await db(`portal_referrers?stripe_account_id=eq.acct_test_mike`, { method: "PATCH", body: { payouts_enabled: false } });
  const calls = [];
  const stripeTransfer = async () => { calls.push(1); return { id: "tr_no" }; };
  const manual = await approvePayout(db, { payoutId: payout.id, stripeTransfer, connectConfigured: true });
  assert.equal(manual.transferred, false);
  assert.equal(manual.status, "approved_awaiting_onboarding");
  assert.equal(calls.length, 0);
  const fresh = await readyPayout();
  const missing = await approvePayout(fresh.db, { payoutId: fresh.payout.id, stripeTransfer, connectConfigured: false });
  assert.equal(missing.manual, true);
  assert.equal(calls.length, 0);
});

test("webhooks in this app do not send referral payouts", () => {
  const webhook = read("pages/api/webhooks/stripe-invoices.js");
  const route = read("pages/api/admin/referrals.js");
  assert.doesNotMatch(webhook, /approvePayout|STRIPE_CONNECT_SECRET_KEY|\/v1\/transfers/);
  assert.match(route, /STRIPE_CONNECT_SECRET_KEY/);
  assert.doesNotMatch(route, /STRIPE_HUB_SECRET_KEY/);
  const sql = read("supabase/portal_016_referrer_connect.sql");
  assert.match(sql, /stripe_account_id/);
  assert.match(sql, /payouts_enabled/);
  assert.doesNotMatch(sql, /drop table|delete from/i);
});

test("the admin action passes the connect flag and does not transfer on its own", async () => {
  const { db, payout } = await readyPayout();
  const calls = [];
  const result = await runReferralAdmin(db, {
    method: "POST",
    body: { action: "approve-payout", id: payout.id },
    connectConfigured: true,
    stripeTransfer: async (params, key) => { calls.push(key); return { id: "tr_admin" }; },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.transferred, true);
  assert.equal(calls[0], `referral_${payout.referral_id}`);
});
