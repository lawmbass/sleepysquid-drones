import test from "node:test";
import assert from "node:assert/strict";
import {
  canMarkCompleted,
  canUnmarkCompleted,
  importedMissionCompleted,
  lifecycleStatus,
  listingDeleteState,
  listingWindowEnd,
  withCompletedTag,
} from "../../libs/listingLifecycle.js";

const NOW = new Date("2026-10-30T21:00:00Z");

// Shape of the Oct 11 Zeitview import rows (fake ids).
const imported = {
  status: "accepted",
  storedStatus: "accepted",
  botAcceptedAt: null,
  bookingId: null,
  cancelStatus: null,
  dueWindowStart: "2024-08-27T13:00:00Z",
  dueWindowEnd: "2024-08-28T21:00:00Z",
  tags: [],
};

test("imported past Zeitview mission is completed", () => {
  assert.equal(importedMissionCompleted(imported, NOW), true);
  assert.equal(lifecycleStatus({ ...imported, workComplete: true }), "completed");
});

test("bot-accepted, booked, cancelled, or future missions are not auto-completed", () => {
  assert.equal(importedMissionCompleted({ ...imported, botAcceptedAt: "2026-10-30T19:45:00Z" }, NOW), false);
  assert.equal(importedMissionCompleted({ ...imported, bookingId: "b1" }, NOW), false);
  assert.equal(importedMissionCompleted({ ...imported, cancelStatus: "cancelled" }, NOW), false);
  assert.equal(importedMissionCompleted({ ...imported, dueWindowStart: null, dueWindowEnd: "2026-10-30T15:00:00Z" }, NOW), false);
  assert.equal(importedMissionCompleted({ ...imported, dueWindowStart: null, dueWindowEnd: null }, NOW), false);
  assert.equal(importedMissionCompleted({ ...imported, status: "seen", storedStatus: "seen" }, NOW), false);
});

test("window end falls back to start, then deadline", () => {
  assert.equal(listingWindowEnd({ dueWindowStart: "2025-05-27T12:00:00Z" }).toISOString(), "2025-05-27T12:00:00.000Z");
  assert.equal(listingWindowEnd({ deadline: "2025-05-27" }).toISOString(), "2025-05-27T00:00:00.000Z");
  assert.equal(listingWindowEnd({}), null);
});

test("lifecycle status keeps stored status unless an accepted gig is complete", () => {
  assert.equal(lifecycleStatus({ status: "accepted", storedStatus: "accepted", workComplete: false }), "accepted");
  assert.equal(lifecycleStatus({ status: "accepted", storedStatus: "accepted", workComplete: true, cancelStatus: "cancelled" }), "accepted");
  assert.equal(lifecycleStatus({ status: "needs_review", storedStatus: "seen", workComplete: false }), "needs_review");
});

test("seen, needs review and declined listings can be deleted", () => {
  for (const status of ["seen", "needs_review", "declined_by_filter", "expired", "unavailable"]) {
    assert.equal(listingDeleteState({ status, storedStatus: status === "needs_review" ? "seen" : status }).canDelete, true, status);
  }
});

test("accepted gig cannot be deleted until cancelled", () => {
  const accepted = { status: "accepted", storedStatus: "accepted", workComplete: false };
  const blocked = listingDeleteState(accepted);
  assert.equal(blocked.canDelete, false);
  assert.equal(blocked.reason, "accepted");
  assert.match(blocked.message, /Cancel the gig first/);
  assert.equal(listingDeleteState({ ...accepted, cancelStatus: "cancel_requested" }).canDelete, false);
  assert.equal(listingDeleteState({ ...accepted, cancelStatus: "cancelled" }).canDelete, true);
});

test("completed gig cannot be deleted unless cancelled first", () => {
  const done = { status: "accepted", storedStatus: "accepted", workComplete: true };
  assert.equal(listingDeleteState(done).reason, "completed");
  assert.equal(listingDeleteState({ status: "seen", bookingId: "b", bookingStatus: "completed" }).reason, "completed");
  assert.equal(listingDeleteState({ ...done, cancelStatus: "cancelled" }).canDelete, true);
});

test("listing with a live booking is blocked; deleted listing is not deleted twice", () => {
  assert.equal(listingDeleteState({ status: "seen", bookingId: "b", bookingStatus: "confirmed" }).reason, "booked");
  assert.equal(listingDeleteState({ status: "seen", bookingId: "b", bookingStatus: "cancelled" }).canDelete, true);
  assert.equal(listingDeleteState({ status: "seen", deletedAt: "2026-10-30T21:00:00Z" }).reason, "already_deleted");
  assert.equal(listingDeleteState(null).reason, "not_found");
});

test("mark and unmark completed", () => {
  const accepted = { status: "accepted", storedStatus: "accepted", workComplete: false, tags: ["vip"] };
  assert.equal(canMarkCompleted(accepted), true);
  assert.equal(canMarkCompleted({ ...accepted, workComplete: true }), false);
  assert.equal(canMarkCompleted({ ...accepted, cancelStatus: "cancelled" }), false);
  assert.equal(canMarkCompleted({ status: "seen", storedStatus: "seen" }), false);
  assert.deepEqual(withCompletedTag(["vip"], true), ["vip", "completed"]);
  assert.deepEqual(withCompletedTag(["vip", "Completed"], false), ["vip"]);
  assert.deepEqual(withCompletedTag(["completed"], true), ["completed"]);
  assert.equal(canUnmarkCompleted({ ...accepted, tags: ["completed"] }), true);
  assert.equal(canUnmarkCompleted(accepted), false);
});
