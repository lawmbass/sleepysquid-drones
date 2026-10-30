import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CANCEL_EMAIL_STUCK_MS,
  cancelEmailBlock,
  cancelEmailMessageKey,
  cancelEmailView,
  queueCancelEmailFields,
} from "../../libs/cancelEmail.js";
import { buildCancelDraft, PILOT_EMAIL } from "../../libs/cancelGig.js";

const ID = "11111111-2222-3333-4444-555555555555";
const NOW = new Date("2026-10-30T21:30:00Z");
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("message key is a stable RFC 5322 id the bot accepts", () => {
  const key = cancelEmailMessageKey(ID, NOW);
  assert.equal(key, `<cancel-${ID}-${NOW.getTime()}@drones.sleepysquid.com>`);
  // Same pattern the drone-gigs outbox validates before sending.
  assert.match(key, /^<[A-Za-z0-9._-]+@[A-Za-z0-9.-]+>$/);
  assert.match(cancelEmailMessageKey("x>\r\nBcc: a@b.c", NOW), /^<[A-Za-z0-9._-]+@[A-Za-z0-9.-]+>$/);
});

test("queue fields mark cancel_requested and queue the shown email", () => {
  const draft = buildCancelDraft({ missionId: "DBM0000000001", address: "100 Example St", schedule: null, reason: "Weather" });
  const fields = queueCancelEmailFields({ listingId: ID, draft, reason: "Weather", now: NOW });
  assert.equal(fields.cancel_status, "cancel_requested");
  assert.equal(fields.cancel_reason, "Weather");
  assert.equal(fields.cancel_email_status, "queued");
  assert.equal(fields.cancel_email_subject, "Cancel mission DBM0000000001 – 100 Example St");
  assert.equal(fields.cancel_email_body, draft.body);
  assert.equal(fields.cancel_email_gmail_id, null);
  assert.equal(fields.cancel_email_requested_at, NOW.toISOString());
  // No recipient column: the bot hard-codes pilots@dronebase.com.
  assert.equal(Object.keys(fields).some((k) => /_to$|recipient/.test(k)), false);
  assert.equal(draft.to, PILOT_EMAIL);
});

test("reschedule is gone: the draft always asks to cancel", () => {
  const draft = buildCancelDraft({ intent: "reschedule", missionId: "DBM1", address: "Deale", reason: "Conflict" });
  assert.equal(draft.subject, "Cancel mission DBM1 – Deale");
  assert.match(draft.body, /Could you cancel this mission\?/);
  assert.doesNotMatch(draft.body, /reschedule/i);
});

test("a second send is blocked while one is open or already sent", () => {
  assert.equal(cancelEmailBlock({ cancelEmailStatus: null }), null);
  assert.equal(cancelEmailBlock({ cancelEmailStatus: "failed", cancelStatus: "cancel_requested" }), null);
  assert.match(cancelEmailBlock({ cancelEmailStatus: "queued" }), /already being sent/);
  assert.match(cancelEmailBlock({ cancelEmailStatus: "sending" }), /already being sent/);
  assert.match(cancelEmailBlock({ cancelEmailStatus: "sent", cancelStatus: "cancel_requested" }), /already sent/);
  // After Undo clears the cancel status, a new request may send again.
  assert.equal(cancelEmailBlock({ cancelEmailStatus: "sent", cancelStatus: null }), null);
});

test("dialog view: sending polls, sent shows the Gmail id, failure falls back to drafts", () => {
  assert.deepEqual(cancelEmailView(null, NOW), { state: "idle", showDrafts: false, poll: false });
  const queued = { cancelEmailStatus: "queued", cancelEmailRequestedAt: new Date(NOW - 30000).toISOString() };
  assert.equal(cancelEmailView(queued, NOW).state, "sending");
  assert.equal(cancelEmailView(queued, NOW).poll, true);
  assert.equal(cancelEmailView(queued, NOW).showDrafts, false);

  const sent = cancelEmailView({ cancelEmailStatus: "sent", cancelEmailGmailId: "18f0abc", cancelEmailSentAt: NOW.toISOString() }, NOW);
  assert.equal(sent.state, "sent");
  assert.equal(sent.gmailId, "18f0abc");
  assert.equal(sent.showDrafts, false);

  const failed = cancelEmailView({ cancelEmailStatus: "failed", cancelEmailError: "Insufficient Permission" }, NOW);
  assert.equal(failed.state, "failed");
  assert.equal(failed.showDrafts, true);
  assert.equal(failed.error, "Insufficient Permission");

  const stuck = cancelEmailView({ cancelEmailStatus: "queued", cancelEmailRequestedAt: new Date(NOW - CANCEL_EMAIL_STUCK_MS - 1000).toISOString() }, NOW);
  assert.equal(stuck.state, "stuck");
  assert.equal(stuck.showDrafts, true);
  assert.equal(stuck.poll, true);
});

test("send route: confirm required, built server-side, queued conditionally, no mail library", () => {
  const route = read("pages/api/admin/listings/[id]/cancel.js");
  assert.match(route, /action === "send"/);
  assert.match(route, /req\.body\?\.confirm !== true/);
  assert.match(route, /cancelEmailBlock\(existing\)/);
  assert.match(route, /queueListingCancelEmail\(id,/);
  assert.match(route, /status\(409\)/);
  assert.doesNotMatch(route, /req\.body\?\.(to|subject|body|intent)\b/);
  assert.doesNotMatch(route, /googleapis|nodemailer|gmail\.users|resend/i);
  assert.doesNotMatch(route, /reschedule/);
});

test("queue update only matches when no send is open", () => {
  const db = read("libs/db/listings.js");
  const fn = db.slice(db.indexOf("export async function queueListingCancelEmail"));
  assert.match(fn.slice(0, 600), /cancel_email_status\.is\.null,cancel_email_status\.eq\.failed,and\(cancel_email_status\.eq\.sent,cancel_status\.is\.null\)/);
});

test("dialog has no reschedule option and confirms before sending", () => {
  const modal = read("components/admin/CancelGigModal.jsx");
  assert.doesNotMatch(modal, /Ask to reschedule|cancel-intent|setIntent/);
  assert.match(modal, /Send cancellation/);
  assert.match(modal, /setConfirming\(true\)/);
  assert.match(modal, /action: "send", confirm: true/);
  assert.match(modal, /emailView\.showDrafts/);
  assert.match(modal, /Open in Gmail/);
});

test("migration adds the outbox columns and is not applied by code", () => {
  const sql = read("supabase/migrations/20261030230000_cancel_email_outbox.sql");
  for (const col of ["cancel_email_status", "cancel_email_subject", "cancel_email_body", "cancel_email_message_key", "cancel_email_requested_at", "cancel_email_attempted_at", "cancel_email_sent_at", "cancel_email_gmail_id", "cancel_email_error"]) {
    assert.match(sql, new RegExp(`ADD COLUMN ${col} `));
  }
  assert.match(sql, /'queued', 'sending', 'sent', 'failed'/);
});
