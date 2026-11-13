import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { updateReferrer } from "../../libs/referralHub.mjs";
import { runReferralAdmin } from "../../libs/referralAdmin.mjs";

const SECRET = "test-secret-not-used-outside-tests";
const ORIGIN = "https://sleepysquid.com";
const WHEN = "2026-11-13T15:04:00.000Z";

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
  const patches = [];
  async function db(path, { method = "GET", body, prefer } = {}) {
    const q = path.indexOf("?");
    const table = q === -1 ? path : path.slice(0, q);
    const params = new URLSearchParams(q === -1 ? "" : path.slice(q + 1));
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
      patches.push(structuredClone(body));
      const found = hit();
      for (const row of found) Object.assign(row, structuredClone(body));
      return prefer?.includes("return=representation") ? found.map((row) => structuredClone(row)) : null;
    }
    throw new Error(`unexpected ${method} ${table}`);
  }
  return { db, patches, tables };
}

function mike(extra = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mike Example",
    email: "mike.example@example.test",
    phone: "202-555-0148",
    notes: "Sends local businesses.",
    code: "mike4821",
    active: true,
    payouts_enabled: true,
    stripe_account_id: "acct_mike",
    link_email_sent_at: WHEN,
    link_email_error: null,
    archived_at: null,
    deleted_at: null,
    created_at: "2026-11-01T00:00:00.000Z",
    ...extra,
  };
}

const payout = {
  id: "p1",
  referral_id: "c1",
  amount_cents: 20000,
  status: "paid",
  stripe_transfer_id: "tr_preview",
  paid_at: WHEN,
};

function harness(seed) {
  const sent = [];
  const transfers = [];
  const store = fakeDb(seed);
  async function run(body) {
    try {
      return await runReferralAdmin(store.db, {
        method: "POST",
        body,
        origin: ORIGIN,
        secret: SECRET,
        send: async () => { sent.push("mail"); throw new Error("update must not send email"); },
        stripeTransfer: async () => { transfers.push("transfer"); throw new Error("update must not transfer"); },
        now: () => new Date(WHEN),
      });
    } catch (err) {
      const status = err.status || 500;
      return { status, body: { error: status >= 500 ? "Something went wrong" : err.message } };
    }
  }
  return { ...store, sent, transfers, run };
}

test("update-referrer writes only name, email, phone, and notes", async () => {
  const { db, patches, tables, sent, transfers, run } = harness({
    referrers: [mike(), mike({ id: "22222222-2222-4222-8222-222222222222", name: "Sam Example", email: "sam.example@example.test", code: "sam1094", stripe_account_id: null })],
    referrals: [{ id: "c1", referrer_id: mike().id }],
    payouts: [payout],
  });
  const result = await run({
    action: "update-referrer",
    id: mike().id,
    name: "  Morgan Example  ",
    email: "  Morgan.Example@Example.Test ",
    phone: " 202-555-0199 ",
    notes: "  Updated note  ",
    code: "hacked",
    stripe_account_id: "acct_stolen",
    payouts_enabled: false,
    active: false,
    deleted_at: "2020-01-01T00:00:00.000Z",
    archived_at: "2020-01-01T00:00:00.000Z",
    link_email_sent_at: null,
    link_email_error: "nope",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.referrer.name, "Morgan Example");
  assert.equal(result.body.referrer.email, "morgan.example@example.test");
  assert.equal(result.body.referrer.phone, "202-555-0199");
  assert.equal(result.body.referrer.notes, "Updated note");
  assert.equal(result.body.referrer.code, "mike4821");
  assert.equal(result.body.referrer.stripe_account_id, "acct_mike");
  assert.equal(result.body.referrer.payouts_enabled, true);
  assert.equal(result.body.referrer.active, true);
  assert.equal(result.body.referrer.deleted_at, null);
  assert.equal(result.body.referrer.link_email_sent_at, WHEN);
  assert.deepEqual(Object.keys(patches[0]).sort(), ["email", "name", "notes", "phone"]);
  assert.equal(patches.length, 1);
  assert.equal(sent.length, 0);
  assert.equal(transfers.length, 0);
  assert.deepEqual(tables.portal_referral_payouts[0], payout);

  const listed = await runReferralAdmin(db, { method: "GET", origin: ORIGIN, secret: SECRET });
  const row = listed.body.referrers.find((item) => item.id === mike().id);
  assert.equal(row.name, "Morgan Example");
  assert.equal(row.code, "mike4821");
  assert.match(row.links.hub, /\/r\/mike4821$/);
  // The public /r/<code> page reads this name on each request and titles the
  // uncached preview "Get 10% off with {first}'s referral".
  assert.equal(row.name.trim().split(/\s+/)[0], "Morgan");
});

test("a blank name, a bad email, a bad phone, a duplicate email, and a deleted referrer are rejected", async () => {
  const { db, patches, run } = harness({
    referrers: [
      mike(),
      mike({ id: "22222222-2222-4222-8222-222222222222", email: "sam.example@example.test", code: "sam1094" }),
      mike({ id: "33333333-3333-4333-8333-333333333333", email: "gone.example@example.test", code: "gone1000", deleted_at: WHEN }),
    ],
  });
  const blank = await run({ action: "update-referrer", id: mike().id, name: "   ", email: "mike.example@example.test" });
  assert.equal(blank.status, 400);
  assert.equal(blank.body.error, "Name is required");
  const email = await run({ action: "update-referrer", id: mike().id, name: "Mike Example", email: "not-an-email" });
  assert.equal(email.status, 400);
  assert.equal(email.body.error, "Enter a valid email");
  const phone = await run({ action: "update-referrer", id: mike().id, name: "Mike Example", email: "mike.example@example.test", phone: "call me" });
  assert.equal(phone.status, 400);
  assert.equal(phone.body.error, "Enter a phone number or leave it blank");
  const taken = await run({ action: "update-referrer", id: mike().id, name: "Mike Example", email: "sam.example@example.test" });
  assert.equal(taken.status, 409);
  assert.match(taken.body.error, /already exists/);
  const missing = await run({ action: "update-referrer", id: "missing", name: "Mike Example", email: "mike.example@example.test" });
  assert.equal(missing.status, 404);
  const deleted = await run({ action: "update-referrer", id: "33333333-3333-4333-8333-333333333333", name: "Gone Example", email: "gone.example@example.test" });
  assert.equal(deleted.status, 404);
  assert.equal(patches.length, 0);
  const [row] = await db(`portal_referrers?id=eq.${mike().id}&select=*`);
  assert.equal(row.name, "Mike Example");
  assert.equal(row.code, "mike4821");
  assert.equal(row.email, "mike.example@example.test");
});

test("clearing phone and notes, and keeping the same email, does not send mail", async () => {
  const { sent, run } = harness({ referrers: [mike()] });
  const result = await run({
    action: "update-referrer",
    id: mike().id,
    name: "Mike Example",
    email: "MIKE.EXAMPLE@example.test",
    phone: "   ",
    notes: "  ",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.referrer.email, "mike.example@example.test");
  assert.equal(result.body.referrer.phone, null);
  assert.equal(result.body.referrer.notes, null);
  assert.equal(result.body.referrer.code, "mike4821");
  assert.equal(sent.length, 0);
  await assert.rejects(() => updateReferrer(async () => [], { id: "", name: "A", email: "a@example.test" }), /Referrer not found/);
});

test("update-referrer is behind the admin gate and the edit form does not change the code", () => {
  const route = read("pages/api/admin/referrals.js");
  const gate = route.indexOf("if (!sleepyAdmin");
  const run = route.indexOf("await runReferralAdmin");
  assert.ok(gate > -1 && run > gate);
  assert.match(route, /status\(401\)/);
  assert.match(route, /status\(403\)/);
  assert.equal(route.includes("update-referrer"), false);
  const admin = read("libs/referralAdmin.mjs");
  const block = admin.slice(admin.indexOf('action === "update-referrer"'), admin.indexOf('action === "approve-payout"'));
  assert.match(block, /updateReferrer/);
  assert.doesNotMatch(block, /mailed|sendEmail|send\(|stripeTransfer|fetch\(/);
  const ui = read("components/admin/ReferralsSection.jsx");
  const edit = ui.indexOf('data-testid="edit-referrer"');
  const resend = ui.indexOf("Resend link email");
  assert.ok(edit > -1 && edit < resend);
  const dialog = ui.slice(ui.indexOf('data-testid="edit-referrer-dialog"'), ui.indexOf('data-testid="save-referrer"'));
  assert.match(dialog, /Name is required|edit-referrer-name/);
  assert.match(dialog, /edit-referrer-email/);
  assert.match(dialog, /edit-referrer-phone/);
  assert.match(dialog, /edit-referrer-notes/);
  assert.match(dialog, /referrer-code-readonly/);
  assert.match(dialog, /Cancel/);
  assert.match(ui, /"update-referrer"/);
  assert.doesNotMatch(dialog, /stripe_account|name="code"|edit-referrer-code/i);
  assert.doesNotMatch(ui, /supabase\/portal_018/);
});
