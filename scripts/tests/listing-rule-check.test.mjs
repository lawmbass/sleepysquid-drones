import test from "node:test";
import assert from "node:assert/strict";
import { listingRuleCheck, ruleReasonLabel } from "../../libs/listingRuleCheck.js";

test("no score means no badge (Zeitview rows)", () => {
  assert.equal(listingRuleCheck({ rawDetail: {} }), null);
  assert.equal(listingRuleCheck({}), null);
});

test("passing score reads Would accept", () => {
  const check = listingRuleCheck({ rawDetail: { score: { would_accept: true, reasons: [] } } });
  assert.deepEqual(check, { state: "pass", label: "Would accept", reasons: [] });
});

test("failing score lists plain reasons", () => {
  const check = listingRuleCheck({ raw_detail: { score: { would_accept: false, reasons: [
    "too_far: travel_minutes=140 max_drive_minutes=90",
    "long_trip_payout_below_minimum: travel_minutes=140 travel_miles=120 payout=100 minimum_payout=150 threshold_minutes=60",
  ] } } });
  assert.equal(check.state, "fail");
  assert.equal(check.label, "Wouldn't accept");
  assert.deepEqual(check.reasons, ["140 min drive is over the 90 min limit", "Long trip (140 min) needs $150+, pays $100"]);
});

test("review and error states", () => {
  assert.equal(listingRuleCheck({ rawDetail: { score: { would_accept: false, needs_review: true, reasons: ["location_not_found"] } } }).state, "review");
  const err = listingRuleCheck({ rawDetail: { score: { would_accept: null, error: "db down" } } });
  assert.equal(err.state, "error");
  assert.deepEqual(err.reasons, ["db down"]);
});

test("reason labels", () => {
  assert.equal(ruleReasonLabel("payout_below_minimum: payout=10 minimum=50"), "Payout $10 is under the $50 minimum");
  assert.equal(ruleReasonLabel("not_enough_notice: hours_until_flight=5 min_notice_hours=12"), "Only 5 h notice (needs 12 h)");
  assert.equal(ruleReasonLabel("something_new"), "something_new");
});
