import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  approvePayout,
  attributeCode,
  claimEvent,
  createReferrer,
  deleteReferrer,
  listAdmin,
  recordEligiblePayment,
  setReferrerActive,
  submitRequest,
  approveRequest,
} from "../../libs/referralHub.mjs";
import { runReferralAdmin } from "../../libs/referralAdmin.mjs";

const WHEN = "2026-11-13T18:00:00.000Z";

function read(file) {
  return fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
}

function fakeDb(seed = {}) {
  const tables = {
    portal_referrers: seed.referrers || [],
    portal_referral_requests: seed.requests || [],
    portal_referrals: seed.referrals || [],
    portal_referral_payouts: seed.payouts || [],
    portal_referral_events: seed.events || [],
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
    const hit = () => rows.filter((row) => filters.every((filter) => {
      if (filter.op === "eq") return String(row[filter.field]) === filter.value;
      return filter.value === "null" ? row[filter.field] == null : false;
    }));
    if (method === "GET") return hit().map((row) => structuredClone(row));
    if (method === "PATCH") {
      const found = hit();
      for (const row of found) Object.assign(row, structuredClone(body));
      return prefer?.includes("return=representation") ? found.map((row) => structuredClone(row)) : null;
    }
    if (method === "DELETE") {
      const found = new Set(hit());
      for (let i = rows.length - 1; i >= 0; i -= 1) if (found.has(rows[i])) rows.splice(i, 1);
      return null;
    }
    const incoming = structuredClone(body);
    if (onConflict && rows.some((row) => row[onConflict] === incoming[onConflict]) && prefer?.includes("ignore-duplicates")) return [];
    rows.push(incoming);
    return prefer?.includes("return=representation") ? [structuredClone(incoming)] : null;
  };
}

const invoice = { lines: { data: [{ price: { product: { metadata: { service: "drones" } } } }] } };

async function referred(db, referrer, email, customerId) {
  await attributeCode(db, { code: referrer.code, customerId, email, name: "Buyer Example" });
  const paid = await recordEligiblePayment(db, { customerId, email, invoiceId: `in_${customerId}`, invoice, retrieveProduct: async () => ({}) });
  return paid;
}

test("a referrer with no paid payout is hard-deleted with unpaid rows, and a second delete is a no-op", async () => {
  const db = fakeDb();
  const submitted = await submitRequest(db, { name: "Avery Example", email: "avery.example@example.test", note: "Neighbor" });
  const approved = await approveRequest(db, submitted.request.id);
  const referrer = approved.referrer;
  await db(`portal_referrers?id=eq.${referrer.id}`, { method: "PATCH", body: { stripe_account_id: "acct_keep", payouts_enabled: true } });
  await referred(db, referrer, "buyer.example@example.test", "cus_pending");
  const waiting = await referred(db, referrer, "wait.example@example.test", "cus_wait");
  await approvePayout(db, { payoutId: waiting.payout.id, connectConfigured: false, stripeTransfer: async () => { throw new Error("no transfer"); } });
  assert.equal(await claimEvent(db, "evt_invoice_keep", "invoice.paid"), true);
  const calls = [];
  const result = await runReferralAdmin(db, {
    method: "POST",
    body: { action: "delete-referrer", id: referrer.id },
    now: () => new Date(WHEN),
    send: async () => { calls.push("email"); },
    stripeTransfer: async () => { calls.push("stripe"); return { id: "tr_should_not" }; },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, "hard");
  assert.equal(result.body.already, false);
  assert.deepEqual(calls, []);
  assert.equal((await db(`portal_referrers?id=eq.${referrer.id}&select=*`)).length, 0);
  assert.equal((await db(`portal_referrals?referrer_id=eq.${referrer.id}&select=*`)).length, 0);
  assert.equal((await db("portal_referral_payouts?select=*")).length, 0);
  const [request] = await db(`portal_referral_requests?id=eq.${submitted.request.id}&select=*`);
  assert.equal(request.referrer_id, null);
  assert.equal(request.status, "approved");
  const events = await db("portal_referral_events?select=*");
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "evt_invoice_keep");
  const again = await deleteReferrer(db, referrer.id, new Date(WHEN));
  assert.equal(again.mode, "absent");
  assert.equal(again.already, true);
  assert.equal(calls.length, 0);
});

test("a paid payout or a transfer id soft-deletes, voids only unpaid rows, and stays out of the list", async () => {
  const db = fakeDb();
  const mike = await createReferrer(db, { name: "Mike Example", email: "mike.example@example.test", code: "mike4821" });
  const sam = await createReferrer(db, { name: "Sam Example", email: "sam.example@example.test", code: "sam1094" });
  await db(`portal_referrers?id=eq.${mike.id}`, { method: "PATCH", body: { stripe_account_id: "acct_mike", payouts_enabled: true } });
  const pending = await referred(db, mike, "pending.example@example.test", "cus_p");
  const manual = await referred(db, mike, "manual.example@example.test", "cus_m");
  await approvePayout(db, { payoutId: manual.payout.id, connectConfigured: false, stripeTransfer: async () => { throw new Error("no transfer"); } });
  const paid = await referred(db, mike, "paid.example@example.test", "cus_paid");
  await db(`portal_referral_payouts?id=eq.${paid.payout.id}`, {
    method: "PATCH",
    body: { status: "paid", stripe_transfer_id: "tr_book", paid_at: "2026-11-01T00:00:00.000Z", amount_cents: 20000 },
  });
  await attributeCode(db, { code: mike.code, customerId: "cus_open", email: "open.example@example.test", name: "Open Example" });
  const calls = [];
  const result = await runReferralAdmin(db, {
    method: "POST",
    body: { action: "delete-referrer", id: mike.id },
    now: () => new Date(WHEN),
    send: async () => { calls.push("email"); },
    stripeTransfer: async () => { calls.push("stripe"); return { id: "tr_no" }; },
  });
  assert.equal(result.body.mode, "soft");
  assert.equal(result.body.deletedAt, WHEN);
  assert.deepEqual(calls, []);
  const [row] = await db(`portal_referrers?id=eq.${mike.id}&select=*`);
  assert.equal(row.active, false);
  assert.equal(row.deleted_at, WHEN);
  assert.equal(row.stripe_account_id, "acct_mike");
  assert.equal(row.email, "mike.example@example.test");
  const [kept] = await db(`portal_referral_payouts?id=eq.${paid.payout.id}&select=*`);
  assert.equal(kept.status, "paid");
  assert.equal(kept.stripe_transfer_id, "tr_book");
  assert.equal(kept.paid_at, "2026-11-01T00:00:00.000Z");
  assert.equal(kept.amount_cents, 20000);
  const [voidedPending] = await db(`portal_referral_payouts?id=eq.${pending.payout.id}&select=*`);
  const [voidedManual] = await db(`portal_referral_payouts?id=eq.${manual.payout.id}&select=*`);
  assert.equal(voidedPending.status, "void");
  assert.equal(voidedPending.stripe_transfer_id ?? null, null);
  assert.equal(voidedManual.status, "void");
  const again = await deleteReferrer(db, mike.id, new Date("2026-12-01T00:00:00.000Z"));
  assert.equal(again.already, true);
  assert.equal(again.deletedAt, WHEN);
  const [still] = await db(`portal_referrers?id=eq.${mike.id}&select=*`);
  assert.equal(still.deleted_at, WHEN);
  assert.equal(still.stripe_account_id, "acct_mike");
  const listed = await listAdmin(db);
  assert.deepEqual(listed.referrers.map((item) => item.id), [sam.id]);
  assert.equal(listed.payouts.some((item) => item.stripe_transfer_id === "tr_book"), false);
  assert.equal(listed.referrals.some((item) => item.referrer_id === mike.id), false);
  const book = await db("portal_referral_payouts?select=*");
  assert.equal(book.some((item) => item.stripe_transfer_id === "tr_book" && item.status === "paid"), true);
  assert.equal((await attributeCode(db, { code: "mike4821", customerId: "cus_new", email: "new.example@example.test" })).attributed, false);
  await assert.rejects(() => setReferrerActive(db, mike.id, true), /Referrer not found/);
  const [notRevived] = await db(`portal_referrers?id=eq.${mike.id}&select=*`);
  assert.equal(notRevived.active, false);
  assert.equal(notRevived.deleted_at, WHEN);
  assert.equal(notRevived.stripe_account_id, "acct_mike");
  await db(`portal_referrers?id=eq.${mike.id}`, { method: "PATCH", body: { active: true } });
  assert.equal((await attributeCode(db, { code: "mike4821", customerId: "cus_new2", email: "new2.example@example.test" })).attributed, false);
  await db(`portal_referrers?id=eq.${mike.id}`, { method: "PATCH", body: { active: false } });
  const later = await recordEligiblePayment(db, { customerId: "cus_open", email: "open.example@example.test", invoiceId: "in_open", invoice, retrieveProduct: async () => ({}) });
  assert.equal(later.created, false);
  await assert.rejects(() => runReferralAdmin(db, {
    method: "POST",
    body: { action: "resend-link", id: mike.id },
    send: async () => { calls.push("email"); },
    origin: "https://sleepysquid.com",
    secret: "test-secret",
  }), /Referrer not found/);
  assert.deepEqual(calls, []);
  await assert.rejects(() => approvePayout(db, {
    payoutId: voidedPending.id,
    connectConfigured: true,
    stripeTransfer: async () => { calls.push("stripe"); return { id: "tr_late" }; },
  }), /cannot be approved/);
  assert.deepEqual(calls, []);
});

test("a transfer id without a paid status still soft-deletes and leaves that transfer alone", async () => {
  const db = fakeDb();
  const referrer = await createReferrer(db, { name: "Riley Example", email: "riley.example@example.test", code: "riley1001" });
  const paid = await referred(db, referrer, "buyer.example@example.test", "cus_r");
  await db(`portal_referral_payouts?id=eq.${paid.payout.id}`, {
    method: "PATCH",
    body: { status: "pending", stripe_transfer_id: "tr_partial" },
  });
  const result = await deleteReferrer(db, referrer.id, new Date(WHEN));
  assert.equal(result.mode, "soft");
  const [payout] = await db(`portal_referral_payouts?id=eq.${paid.payout.id}&select=*`);
  assert.equal(payout.status, "pending");
  assert.equal(payout.stripe_transfer_id, "tr_partial");
  const [row] = await db(`portal_referrers?id=eq.${referrer.id}&select=*`);
  assert.equal(row.active, false);
  assert.equal(row.deleted_at, WHEN);
});

test("deactivating a referrer still allows an existing signup to earn, and a blank delete is rejected", async () => {
  const db = fakeDb();
  const referrer = await createReferrer(db, { name: "Casey Example", email: "casey.example@example.test" });
  await attributeCode(db, { code: referrer.code, customerId: "cus_c", email: "casey-buyer.example@example.test" });
  await setReferrerActive(db, referrer.id, false);
  const earned = await recordEligiblePayment(db, { customerId: "cus_c", email: "casey-buyer.example@example.test", invoiceId: "in_c", invoice, retrieveProduct: async () => ({}) });
  assert.equal(earned.created, true);
  await assert.rejects(() => deleteReferrer(db, "  "), /Referrer not found/);
  const [row] = await db(`portal_referrers?id=eq.${referrer.id}&select=*`);
  assert.equal(row.deleted_at ?? null, null);
  assert.equal(row.active, false);
});

test("the delete control, admin gate, and migration only add deleted_at", () => {
  const ui = read("components/admin/ReferralsSection.jsx");
  const resend = ui.indexOf("Resend link email");
  const deactivate = ui.indexOf("Deactivate");
  const remove = ui.indexOf('data-testid="delete-referrer"');
  assert.ok(resend > -1 && deactivate > resend && remove > deactivate);
  assert.match(ui, />Delete</);
  assert.match(ui, /bg-red-600/);
  assert.match(ui, /Delete \{confirmDelete\.name\}\?/);
  assert.match(ui, /Their link stops working right away\./);
  assert.match(ui, /role="dialog"/);
  const route = read("pages/api/admin/referrals.js");
  const gate = route.indexOf("if (!sleepyAdmin");
  const run = route.indexOf("await runReferralAdmin");
  assert.ok(gate > -1 && run > gate);
  assert.match(route, /status\(401\)/);
  assert.match(route, /status\(403\)/);
  const admin = read("libs/referralAdmin.mjs");
  const block = admin.slice(admin.indexOf('action === "delete-referrer"'), admin.indexOf('action === "deactivate"'));
  assert.match(block, /deleteReferrer/);
  assert.doesNotMatch(block, /send\(|stripeTransfer|sendEmail|fetch\(/);
  const hub = read("libs/referralHub.mjs");
  const fn = hub.slice(hub.indexOf("export async function deleteReferrer"), hub.indexOf("export function adminReferralView"));
  assert.doesNotMatch(fn, /api\.stripe|sendEmail|resend|mailgun|fetch\(|\/v1\/transfers|\/v1\/accounts/);
  const sql = read("supabase/portal_017_referrer_delete.sql");
  assert.match(sql, /alter table portal\.referrers/i);
  assert.match(sql, /add column if not exists deleted_at timestamptz/i);
  assert.match(sql, /notify pgrst, 'reload schema'/);
  assert.doesNotMatch(sql, /drop table|delete from|truncate|update portal|insert into/i);
});
