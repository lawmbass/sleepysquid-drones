import test from "node:test";
import assert from "node:assert/strict";
import { displayStatus, isNeedsReviewReason } from "../../libs/listingStatus.js";

test("seen + needs_review reason shows as needs_review", () => {
  assert.equal(displayStatus("seen", "needs_review: location_not_found"), "needs_review");
  assert.equal(isNeedsReviewReason("needs_review: location_not_found"), true);
});
test("other statuses unchanged", () => {
  assert.equal(displayStatus("seen", null), "seen");
  assert.equal(displayStatus("declined_by_filter", "location_not_found; payout_below_minimum"), "declined_by_filter");
  assert.equal(displayStatus("accepted", "needs_review: x"), "accepted");
});
