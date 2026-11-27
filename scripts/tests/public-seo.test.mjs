import assert from "node:assert/strict";
import test from "node:test";
import { bookingHref, publicBookingSelection } from "../../libs/manualBooking.js";
import { assertLocalSeo, sameDayFrzPromises } from "../lib/publicSeoRules.mjs";

test("local SEO copy, schema, and indexable pages", () => {
  assertLocalSeo();
});

test("a service-page link preselects a known package and drops unknown ids", () => {
  assert.deepEqual(
    publicBookingSelection({ service: "inspection", package: "roof-property-condition" }),
    { service: "inspection", packageId: "roof-property-condition" },
  );
  assert.deepEqual(
    publicBookingSelection({ service: "nope", package: "listing-photos" }),
    { service: "", packageId: "listing-photos" },
  );
  assert.deepEqual(
    publicBookingSelection({ service: "real-estate", package: "../admin" }),
    { service: "real-estate", packageId: "" },
  );
  assert.equal(
    bookingHref("inspection", "roof-property-condition"),
    "/?service=inspection&package=roof-property-condition#booking",
  );
});

test("same-day FRZ copy can deny the promise and cannot offer it", () => {
  assert.deepEqual(
    sameDayFrzPromises("SleepySquid does not offer same-day flights inside the FRZ."),
    [],
  );
  assert.deepEqual(
    sameDayFrzPromises("We can fly same-day inside the FRZ."),
    ["We can fly same-day inside the FRZ"],
  );
});
