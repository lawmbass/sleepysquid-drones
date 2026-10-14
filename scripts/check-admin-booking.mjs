import assert from "node:assert/strict";
import fs from "node:fs";

const {
  BOOKING_SERVICES,
  MANUAL_SOURCE,
  MANUAL_SOURCE_LABEL,
  availablePackages,
  bookingSourceLabel,
  isMissionSource,
  jobIsMission,
  validateManualBooking,
} = await import("../libs/manualBooking.js");
const { bookingToJob, missionDetailAmounts, summarizeJobs } = await import("../libs/jobs.js");

const now = Date.parse("2026-10-14T12:00:00.000Z");
const soon = new Date(now + 2 * 24 * 60 * 60 * 1000 - 1).toISOString();
const far = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();

function payload(overrides = {}) {
  return {
    service: "aerial-media",
    package: "basic",
    date: far,
    location: "123 Harbor Rd",
    details: "Roof photos",
    name: "Ada Lovelace",
    email: "Ada@Example.com",
    phone: "(410) 555-1212",
    status: "confirmed",
    finalPrice: "250",
    adminNotes: "Called the customer",
    ...overrides,
  };
}

const saved = validateManualBooking(payload(), now);
assert.equal(saved.ok, true);
assert.equal(saved.value.source, MANUAL_SOURCE);
assert.equal(saved.value.source, "manual");
assert.equal(saved.value.email, "ada@example.com");
assert.equal(saved.value.finalPrice, 250);
assert.equal(saved.value.package, "basic");
assert.equal(saved.value.status, "confirmed");
assert.deepEqual(Object.keys(saved.value).sort(), [
  "adminNotes",
  "date",
  "details",
  "email",
  "finalPrice",
  "location",
  "name",
  "package",
  "phone",
  "service",
  "source",
  "status",
].sort());
for (const key of ["estimatedPrice", "missionId", "payout", "travelDistance", "travelTime", "duration", "acceptedAt", "missionEmail", "latitude", "longitude"]) {
  assert.equal(key in saved.value, false);
}

const blankPrice = validateManualBooking(payload({ finalPrice: "" }), now);
assert.equal(blankPrice.ok, true);
assert.equal(blankPrice.value.finalPrice, null);

const zeroPrice = validateManualBooking(payload({ finalPrice: 0 }), now);
assert.equal(zeroPrice.value.finalPrice, 0);

assert.equal(validateManualBooking(payload({ finalPrice: -1 }), now).errors.finalPrice, "Final price must be zero or more");
assert.equal(validateManualBooking(payload({ date: soon }), now).errors.date, "Please select a date that is at least 2 days from today");
assert.equal(validateManualBooking(payload({ email: "not-an-email" }), now).errors.email, "Please enter a valid email");
assert.equal(validateManualBooking(payload({ phone: "123" }), now).errors.phone, "Please enter a valid phone number");
assert.equal(validateManualBooking(payload({ phone: "" }), now).errors.phone, "Please enter your phone number");
assert.equal(validateManualBooking(payload({ status: "accepted" }), now).errors.status, "Please select a status");
assert.equal(validateManualBooking(payload({ service: "aerial-photography" }), now).errors.service, "Please select a service");
assert.equal(validateManualBooking(payload({ service: "inspection", package: "basic" }), now).errors.package, "Please select a valid package for this service");
assert.equal(validateManualBooking(payload({ service: "inspection", package: "standard" }), now).ok, true);
assert.equal(validateManualBooking(payload({ service: "real-estate", package: "" }), now).value.package, null);
assert.equal(validateManualBooking(payload({ location: "x".repeat(201) }), now).ok, false);
assert.equal(validateManualBooking(payload({ location: "x".repeat(200) }), now).ok, true);
assert.equal(validateManualBooking(payload({ details: "x".repeat(1001) }), now).ok, false);
assert.equal(validateManualBooking(payload({ name: "x".repeat(101) }), now).ok, false);
assert.equal(validateManualBooking(payload({ adminNotes: "x".repeat(501) }), now).ok, false);
assert.equal(validateManualBooking(payload({ adminNotes: "x".repeat(500) }), now).ok, true);

const stripped = validateManualBooking(payload({ name: "<b>Ada</b>" }), now);
assert.equal(stripped.value.name, "Ada");

const ignored = validateManualBooking(payload({
  missionId: "DBM1",
  payout: 70,
  estimatedPrice: 199,
  latitude: 38.9,
}), now);
assert.equal(ignored.value.source, "manual");
assert.equal("missionId" in ignored.value, false);
assert.equal("estimatedPrice" in ignored.value, false);
assert.equal("payout" in ignored.value, false);

assert.deepEqual(BOOKING_SERVICES.map((service) => service.id), [
  "aerial-media",
  "mapping-surveying",
  "real-estate",
  "inspection",
  "event-coverage",
  "custom",
]);
assert.deepEqual(availablePackages("mapping-surveying").map((pkg) => pkg.id), ["standard", "premium"]);
assert.deepEqual(availablePackages("aerial-media").map((pkg) => pkg.id), ["basic", "standard", "premium"]);

assert.equal(isMissionSource("manual"), false);
assert.equal(isMissionSource("customer"), false);
assert.equal(isMissionSource("zeitview"), true);
assert.equal(isMissionSource(null), false);
assert.equal(bookingSourceLabel("manual"), MANUAL_SOURCE_LABEL);
assert.equal(bookingSourceLabel("manual"), "Added by admin");
assert.equal(bookingSourceLabel("zeitview"), "Zeitview");
assert.equal(jobIsMission({ source: "manual", isMission: true }), false);
assert.equal(jobIsMission({ source: "zeitview" }), true);
assert.equal(jobIsMission({ unlinkedListing: true, source: "zeitview" }), true);

const manualJob = bookingToJob({
  source: "manual",
  payout: 999,
  travelDistance: 40,
  finalPrice: 250,
  status: "confirmed",
  date: far,
});
assert.equal(manualJob.isMission, false);
const manualAmounts = missionDetailAmounts(manualJob);
assert.equal(manualAmounts.isMission, false);
assert.equal(manualAmounts.payoutIsFixed, false);
assert.equal(manualAmounts.finalPrice, 250);

const missionJob = bookingToJob({
  source: "zeitview",
  payout: 70,
  travelDistance: 10,
  status: "completed",
  date: far,
});
assert.equal(missionJob.isMission, true);
const summary = summarizeJobs([manualJob, missionJob]);
assert.equal(summary.customerBookings, 1);
assert.equal(summary.missionStats.totalMissions, 1);
assert.equal(summary.missionStats.avgTravelDistance, 10);

const publicForm = fs.readFileSync(new URL("../components/home/BookingSection.jsx", import.meta.url), "utf8");
assert.match(publicForm, /id: 'aerial-media'/);
assert.match(publicForm, /mapping-surveying', 'inspection', 'event-coverage', 'custom'/);
assert.doesNotMatch(publicForm, /manualBooking/);
assert.doesNotMatch(publicForm, /\/api\/admin\/bookings\/create/);

const publicApi = fs.readFileSync(new URL("../pages/api/bookings.js", import.meta.url), "utf8");
assert.match(publicApi, /findSameDayBooking/);
assert.match(publicApi, /sendBookingConfirmationEmail/);
assert.match(publicApi, /source: 'customer'/);
assert.doesNotMatch(publicApi, /source: 'manual'/);

const createApi = fs.readFileSync(new URL("../pages/api/admin/bookings/create.js", import.meta.url), "utf8");
assert.match(createApi, /requireAdmin/);
assert.match(createApi, /validateManualBooking/);
assert.match(createApi, /insertBooking\(\{/);
assert.match(createApi, /coordinates: \{ lat: address\.lat, lng: address\.lng \}/);
assert.doesNotMatch(createApi, /findSameDayBooking/);
assert.doesNotMatch(createApi, /sendBookingConfirmationEmail/);
assert.doesNotMatch(createApi, /estimatedPrice/);
assert.doesNotMatch(createApi, /recaptcha/i);

const form = fs.readFileSync(new URL("../components/admin/AddBookingForm.jsx", import.meta.url), "utf8");
assert.match(form, /\/api\/admin\/bookings\/create/);
assert.match(form, /onCreated/);
assert.doesNotMatch(form, /recaptcha/i);
assert.doesNotMatch(form, /estimatedPrice/);
assert.doesNotMatch(form, /location\.reload/);

const filters = fs.readFileSync(new URL("../components/admin/BookingFilters.jsx", import.meta.url), "utf8");
assert.match(filters, /value: 'manual', label: 'Added by admin'/);
assert.doesNotMatch(filters, /Manual Entries/);

const schema = fs.readFileSync(new URL("../supabase/migrations/20261011120000_initial_schema.sql", import.meta.url), "utf8");
assert.match(schema, /CHECK \(source IN \('customer', 'zeitview', 'manual'\)\)/);

console.log("admin booking checks passed");
