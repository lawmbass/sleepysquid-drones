import assert from "node:assert/strict";

const { selectUnlinkedEarnings, unlinkedPayoutTotal } = await import("../libs/earnings.js");
const { mergeJobs, summarizeJobs, summarizeAnalytics } = await import("../libs/jobs.js");
const { adminConfig } = await import("../libs/adminConfig.js");

const linked = {
  status: "accepted",
  bookingId: "11111111-1111-1111-1111-111111111111",
  payout: 400,
  source: "zeitview",
};
const open = {
  status: "accepted",
  bookingId: null,
  payout: 250,
  source: "zeitview",
  deadline: "2026-01-15T00:00:00.000Z",
  travelDistance: 12,
};
const declined = {
  status: "declined_by_filter",
  bookingId: null,
  payout: 900,
  source: "zeitview",
};
const undated = {
  status: "accepted",
  bookingId: null,
  payout: 80,
  source: "zeitview",
};

const listings = [linked, open, declined, undated];

assert.equal(unlinkedPayoutTotal(listings), 330);
assert.equal(selectUnlinkedEarnings(listings).length, 2);
assert.equal(selectUnlinkedEarnings(listings)[0].status, "completed");
assert.equal(selectUnlinkedEarnings(listings, { status: "confirmed" }).length, 0);
assert.equal(selectUnlinkedEarnings(listings, { status: "completed" }).length, 2);
assert.equal(
  selectUnlinkedEarnings(listings, { dateFrom: "2026-01-01T00:00:00.000Z", dateTo: "2026-01-31T00:00:00.000Z" }).length,
  1
);
assert.equal(selectUnlinkedEarnings(listings, { source: "manual" }).length, 0);

const booking = {
  id: "booking-1",
  source: "zeitview",
  status: "confirmed",
  payout: 400,
  service: "inspection",
  date: "2026-02-01T00:00:00.000Z",
  location: "Linked site",
  name: "Linked gig",
};
const linkedListing = {
  id: "listing-linked",
  status: "accepted",
  bookingId: "booking-1",
  payout: 400,
  source: "zeitview",
  missionType: "roof",
};
const openListing = {
  id: "listing-open",
  status: "accepted",
  bookingId: null,
  payout: 250,
  source: "zeitview",
  missionType: "thermal",
  clientName: "Acme",
  address: "1 Main St",
  title: "Thermal roof",
  deadline: "2026-01-15T00:00:00.000Z",
  travelDistance: 12,
};
const customer = {
  id: "booking-2",
  source: "customer",
  status: "pending",
  estimatedPrice: 100,
  service: "real-estate",
  date: "2026-06-01T00:00:00.000Z",
  location: "Customer site",
  name: "Customer",
};

const jobs = mergeJobs([booking, customer], [linkedListing, openListing, declined]);
const summary = summarizeJobs(jobs, { now: new Date("2026-03-01T00:00:00.000Z") });
assert.equal(summary.totalJobs, 3);
assert.equal(summary.totalRevenue, 750);
assert.equal(summary.stats.completed.count, 1);
assert.equal(summary.stats.completed.totalValue, 250);
assert.equal(summary.stats.confirmed.count, 1);
assert.equal(summary.customerBookings, 1);
assert.equal(summary.missionStats.totalMissions, 2);
assert.equal(summary.missionStats.totalPayout, 650);
assert.equal(summary.upcomingCount, 1);
assert.equal(summary.recentJobs[0].id, "booking-2");
const thermal = jobs.find((job) => job.id === "listing-open");
assert.equal(thermal.service, "thermal");
assert.equal(thermal.location, "1 Main St");
assert.equal(thermal.status, "completed");
assert.equal(thermal.date, "2026-01-15T00:00:00.000Z");

const analytics = summarizeAnalytics(filterForJanuary(jobs));
assert.equal(analytics.summary.totalJobs, 1);
assert.equal(analytics.summary.totalRevenue, 250);
assert.equal(analytics.summary.completionRate, 100);
assert.equal(analytics.topServices[0].service, "thermal");
assert.equal(analytics.revenueByMonth[0].totalValue, 250);
assert.equal(analytics.sourceBreakdown.zeitview.count, 1);

function filterForJanuary(rows) {
  return rows.filter((job) => job.date && job.date.startsWith("2026-01"));
}

process.env.ADMIN_EMAILS = "Lawrence@SleepySquid.com, pilot@example.com";
adminConfig.reloadFromEnv();

assert.equal(adminConfig.isAdmin("lawrence@sleepysquid.com"), true);
assert.equal(adminConfig.isAdmin("other@sleepysquid.com"), true);
assert.equal(adminConfig.isAdmin("pilot@example.com"), true);
assert.equal(adminConfig.isAdmin("guest@example.com"), false);
assert.equal(adminConfig.isAdmin(""), false);

console.log("Admin role and unlinked earnings checks passed.");
