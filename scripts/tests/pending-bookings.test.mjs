import test from "node:test";
import assert from "node:assert/strict";
import { validateManualBooking } from "../../libs/manualBooking.js";
import { validateContactPatch } from "../../libs/bookingContactPatch.js";
import { summarizeAnalytics, summarizeJobs } from "../../libs/jobs.js";

const future = new Date(Date.now() + 5 * 86400000).toISOString();
const base = { serviceLine: "drones", service: "aerial-media", package: "listing-photos", date: future, name: "Pat" };

test("pending drone booking saves without location/email/phone", () => {
  const r = validateManualBooking({ ...base, status: "pending" });
  assert.deepEqual(r.errors || {}, {}, JSON.stringify(r.errors));
  assert.equal(r.value.location, null);
  assert.equal(r.value.email, null);
  assert.equal(r.value.phone, null);
});

test("formats still checked when entered", () => {
  const r = validateManualBooking({ ...base, status: "pending", email: "nope", phone: "12" });
  assert.ok(r.errors.email);
  assert.ok(r.errors.phone);
});

test("confirmed booking still requires contact", () => {
  const r = validateManualBooking({ ...base, status: "confirmed" });
  assert.ok(r.errors.location && r.errors.email && r.errors.phone);
});

test("patch adds details later and blocks leaving pending with blanks", () => {
  const existing = { source: "manual", serviceLine: "drones", status: "pending", location: null, email: null, phone: null };
  const ok = validateContactPatch({ email: "A@B.co", phone: "555 123 4567" }, existing);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.updates.email, "a@b.co");
  const bad = validateContactPatch({ status: "confirmed" }, existing);
  assert.ok(bad.errors.location && bad.errors.email);
  const fmt = validateContactPatch({ email: "x" }, existing);
  assert.ok(fmt.errors.email);
});

test("money/travel metrics count only completed jobs", () => {
  const jobs = [
    { status: "completed", source: "zeitview", payout: 510, travelDistance: 10, travelTime: 20, date: "2026-10-01T12:00:00Z", isMission: true },
    { status: "pending", source: "manual", finalPrice: 500, travelDistance: 90, travelTime: 100, date: "2026-10-02T12:00:00Z" },
    { status: "cancelled", source: "zeitview", payout: 300, travelDistance: 40, date: "2026-10-03T12:00:00Z", isMission: true },
  ];
  const r = summarizeAnalytics(jobs);
  assert.equal(r.summary.totalRevenue, 510);
  assert.equal(r.summary.revenuePerMile, 51);
  assert.equal(r.summary.avgTravelDistance, 10);
  assert.equal(r.summary.totalMissions, 3);
  assert.equal(r.summary.statusCounts.pending, 1);
  assert.equal(r.sourceBreakdown.manual.totalPayout, 0);
  assert.equal(r.sourceBreakdown.manual.count, 1);
  assert.equal(r.locationInsights.length, 1);
  const s = summarizeJobs(jobs);
  assert.equal(s.revenueByMonth[0].totalValue, 510);
  assert.equal(s.missionStats.avgTravelDistance, 10);
});
