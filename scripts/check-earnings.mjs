import assert from "node:assert/strict";

const { selectUnlinkedEarnings, unlinkedPayoutTotal } = await import("../libs/earnings.js");
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

process.env.ADMIN_EMAILS = "Lawrence@SleepySquid.com, pilot@example.com";
adminConfig.reloadFromEnv();

assert.equal(adminConfig.isAdmin("lawrence@sleepysquid.com"), true);
assert.equal(adminConfig.isAdmin("other@sleepysquid.com"), true);
assert.equal(adminConfig.isAdmin("pilot@example.com"), true);
assert.equal(adminConfig.isAdmin("guest@example.com"), false);
assert.equal(adminConfig.isAdmin(""), false);

console.log("Admin role and unlinked earnings checks passed.");
