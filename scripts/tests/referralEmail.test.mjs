import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { submitRequest } from "../../libs/referralHub.mjs";
import { REFERRAL_EMAIL_FAILED, sendReferrerLinkEmail } from "../../libs/referralEmail.mjs";
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

function harness(seed) {
  const sent = [];
  const db = fakeDb(seed);
  async function send(message) { sent.push(message); }
  function run(body, extra = {}) {
    return runReferralAdmin(db, {
      method: "POST",
      body,
      origin: ORIGIN,
      secret: SECRET,
      send: extra.send || send,
      now: extra.now || (() => new Date(WHEN)),
    });
  }
  return { db, sent, run };
}

function assertReferralCopy(message, links) {
  assert.equal(message.subject, "Your SleepySquid referral link");
  assert.equal(message.fromName, "SleepySquid");
  assert.equal(message.from, undefined);
  assert.equal(message.replyTo, "support@sleepysquid.com");
  assert.match(message.to, /@example\.test$/);
  for (const href of [links.hub, links.web, links.drones, links.ai, links.home]) {
    assert.ok(message.html.includes(href), href);
    assert.ok(message.text.includes(href), href);
  }
  assert.match(message.html, /Keep this page link private/);
  assert.match(message.text, /keep this page link private/i);
  assert.match(message.html, /no cap/i);
  assert.deepEqual(message.html.match(/\$\d[\d,]*/g), ["$200"]);
  assert.deepEqual(message.text.match(/\$\d[\d,]*/g), ["$200"]);
  assert.doesNotMatch(message.html, /SleepySquid AI|ai\.sleepysquid\.com/);
  assert.equal(message.html.includes(SECRET), false);
  assert.equal(message.text.includes(SECRET), false);
}

test("creating a referrer sends one link email and records the time", async () => {
  const { db, sent, run } = harness();
  const result = await run({ action: "create", name: "Mike Example", email: "Mike.Example@example.test" });
  assert.equal(result.status, 201);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "mike.example@example.test");
  assertReferralCopy(sent[0], result.body.links);
  assert.match(result.body.links.home, /^https:\/\/sleepysquid\.com\/referrals\/you\//);
  assert.equal(result.body.email.sent, true);
  assert.equal(result.body.email.sentAt, WHEN);
  const [row] = await db(`portal_referrers?id=eq.${result.body.referrer.id}&select=*`);
  assert.equal(row.link_email_sent_at, WHEN);
  assert.equal(row.link_email_error, null);
  assert.equal(row.name, "Mike Example");
});

test("approving a request sends the new referrer their link", async () => {
  const { db, sent, run } = harness();
  const submitted = await submitRequest(db, { name: "Avery Example", email: "avery.example@example.test", note: "Neighbor" });
  const result = await run({ action: "approve-request", id: submitted.request.id });
  assert.equal(result.status, 200);
  assert.equal(result.body.request.status, "approved");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "avery.example@example.test");
  assertReferralCopy(sent[0], result.body.links);
  const [row] = await db(`portal_referrers?email=eq.avery.example@example.test&select=*`);
  assert.equal(row.link_email_sent_at, WHEN);
});

test("no email means no send", async () => {
  const { db, sent, run } = harness({ referrers: [{ id: "none", name: "Pat Example", email: "", code: "pat0001" }] });
  const skipped = await sendReferrerLinkEmail(db, { id: "none", name: "Pat Example", email: "  ", code: "pat0001" }, {
    origin: ORIGIN, secret: SECRET, send: async () => { throw new Error("should not send"); },
  });
  assert.equal(skipped.sent, false);
  assert.equal(skipped.skipped, "no_email");
  const resent = await run({ action: "resend-link", id: "none" });
  assert.equal(resent.status, 200);
  assert.equal(resent.body.email.sent, false);
  assert.equal(resent.body.email.skipped, "no_email");
  assert.equal(sent.length, 0);
  await assert.rejects(() => run({ action: "create", name: "No Email", email: "" }));
  assert.equal(sent.length, 0);
  const rows = await db("portal_referrers?select=*");
  assert.equal(rows.length, 1);
});

test("a send failure does not block create or approve", async () => {
  const { db, run } = harness();
  let calls = 0;
  const send = async () => { calls += 1; throw new Error("Resend send failed: 500 secret-looking-body"); };
  const created = await run({ action: "create", name: "Mike Example", email: "mike.example@example.test" }, { send });
  assert.equal(created.status, 201);
  assert.equal(created.body.email.sent, false);
  assert.equal(created.body.email.error, REFERRAL_EMAIL_FAILED);
  assert.doesNotMatch(created.body.email.error, /secret-looking-body|Resend/);
  const [row] = await db("portal_referrers?select=*");
  assert.equal(row.email, "mike.example@example.test");
  assert.equal(row.link_email_sent_at ?? null, null);
  assert.equal(row.link_email_error, REFERRAL_EMAIL_FAILED);

  const submitted = await submitRequest(db, { name: "Avery Example", email: "avery.example@example.test" });
  const approved = await run({ action: "approve-request", id: submitted.request.id }, { send });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.request.status, "approved");
  assert.equal(approved.body.email.sent, false);
  assert.equal(calls, 2);
  const [avery] = await db("portal_referrers?email=eq.avery.example@example.test&select=*");
  assert.ok(avery.code);
  assert.equal(avery.link_email_sent_at ?? null, null);
});

test("resend sends again and a later failure keeps the earlier sent time", async () => {
  const { db, sent, run } = harness();
  const created = await run({ action: "create", name: "Mike Example", email: "mike.example@example.test" });
  const resent = await run({ action: "resend-link", id: created.body.referrer.id }, {
    now: () => new Date("2026-11-14T12:00:00.000Z"),
  });
  assert.equal(resent.status, 200);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].to, "mike.example@example.test");
  assert.equal(resent.body.email.sentAt, "2026-11-14T12:00:00.000Z");
  const failed = await run({ action: "resend-link", id: created.body.referrer.id }, {
    send: async () => { throw new Error("down"); },
  });
  assert.equal(failed.status, 200);
  assert.equal(failed.body.email.sent, false);
  const [row] = await db(`portal_referrers?id=eq.${created.body.referrer.id}&select=*`);
  assert.equal(row.link_email_sent_at, "2026-11-14T12:00:00.000Z");
  assert.equal(row.link_email_error, REFERRAL_EMAIL_FAILED);
  assert.equal(sent.length, 2);
});

test("a name is escaped and a missed sent-time write still counts as sent", async () => {
  const { db, sent, run } = harness();
  const created = await run({ action: "create", name: "<script> Example", email: "mike.example@example.test" });
  assert.doesNotMatch(sent[0].html, /<script>/);
  assert.match(sent[0].html, /Hi &lt;script&gt;/);
  const base = db;
  let blocked = false;
  const wrapping = async (path, opts = {}) => {
    if (opts.method === "PATCH" && opts.body?.link_email_sent_at) {
      blocked = true;
      throw new Error("column link_email_sent_at is missing");
    }
    return base(path, opts);
  };
  const result = await runReferralAdmin(wrapping, {
    method: "POST",
    body: { action: "resend-link", id: created.body.referrer.id },
    origin: ORIGIN,
    secret: SECRET,
    send: async (message) => { sent.push(message); },
    now: () => new Date(WHEN),
  });
  assert.equal(blocked, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.email.sent, true);
  assert.equal(result.body.email.recorded, false);
});

test("the referrals list has a resend button and the migration only adds columns", () => {
  const ui = read("components/admin/ReferralsSection.jsx");
  assert.match(ui, /Resend link email/);
  assert.match(ui, /Emailed \{emailed\}/);
  assert.match(ui, /Email failed/);
  assert.match(ui, /resend-link/);
  assert.match(ui, /disabled=\{!String\(row\.email \|\| ""\)\.trim\(\)/);
  assert.match(ui, /Mike Example/);
  assert.match(ui, /Payouts are manual\. Approve here, then pay them yourself\./);
  assert.match(ui, />Mark approved</);
  assert.match(ui, /Approved, pay manually/);
  assert.doesNotMatch(ui, /STRIPE_|test key|\bConnect\b|transfer/i);
  const route = read("pages/api/admin/referrals.js");
  assert.match(route, /runReferralAdmin/);
  assert.match(route, /send: sendEmail/);
  assert.match(route, /status\(401\)/);
  assert.match(route, /status\(403\)/);
  assert.doesNotMatch(route, /api\.resend\.com|nodemailer|MAILGUN_API_KEY/);
  const sql = read("supabase/portal_015_referrer_link_email.sql");
  assert.match(sql, /alter table portal\.referrers/i);
  assert.match(sql, /link_email_sent_at/);
  assert.match(sql, /link_email_error/);
  assert.doesNotMatch(sql, /drop table|delete from|truncate/i);
});
