import assert from "node:assert/strict";
import fs from "node:fs";

const {
  decideListing,
  HOME_PIN_REJECTED,
  classifyHomePin,
  homeAddressChanged,
  previewDecisions,
  sameHomePin,
  validateBotSettings,
  DEFAULT_BOT_SETTINGS,
} = await import("../libs/botRules.js");
const { pinFromPlaceDetails, placesError, suggestionsFromAutocomplete } = await import("../libs/places.js");
const {
  MAX_ROUTE_CALLS,
  clearDriveTimeCache,
  computePreviewDriveTimes,
  destinationForListing,
  listingsWithDraftDrives,
  minutesFromDuration,
  storedDrivesMatch,
} = await import("../libs/driveTimes.js");

const defaults = { ...DEFAULT_BOT_SETTINGS };

function listing(overrides) {
  return {
    id: overrides.id || "listing",
    externalMissionId: overrides.externalMissionId || "DBM1",
    payout: 120,
    travelTime: 30,
    firstSeenAt: "2026-06-15T16:00:00.000Z",
    ...overrides,
  };
}

assert.equal(decideListing(listing({ payout: 40 }), defaults).reason, "payout_below_minimum");
assert.equal(decideListing(listing({ payout: null }), defaults).reason, "payout_missing");
assert.equal(decideListing(listing({ payout: 40, travelTime: null }), defaults).reason, "payout_below_minimum");
assert.equal(decideListing(listing({ travelTime: null }), defaults).reason, "drive_time_missing");
assert.equal(decideListing(listing({ travelTime: 90, payout: 80 }), defaults).reason, "long_trip_payout");
assert.equal(decideListing(listing({ travelTime: 60, payout: 100 }), defaults).decision, "accept");
assert.equal(decideListing(listing({ travelTime: 59, payout: 50 }), defaults).decision, "accept");
assert.equal(
  decideListing(listing({ travelTime: 200, payout: 500 }), { ...defaults, maxDriveMinutes: 180 }).reason,
  "drive_too_long"
);
assert.equal(
  decideListing(listing({ travelTime: 180, payout: 500 }), { ...defaults, maxDriveMinutes: 180 }).decision,
  "accept"
);
assert.equal(
  decideListing(listing({ payout: 500, travelTime: 10 }), { ...defaults, autoAcceptEnabled: false }).decision,
  "skip"
);

const shortNotice = listing({
  payout: 200,
  travelTime: 20,
  firstSeenAt: "2025-05-27T16:30:00.000Z",
  rawDetail: { text: "05/27/2025 02:30PM\nYou must arrive on time" },
});
assert.equal(
  decideListing(shortNotice, { ...defaults, minNoticeHours: 12 }).reason,
  "too_little_notice"
);
assert.equal(decideListing(shortNotice, { ...defaults, minNoticeHours: 1 }).decision, "accept");
assert.equal(
  decideListing(
    listing({
      payout: 200,
      travelTime: 20,
      firstSeenAt: "2020-01-01T00:00:00.000Z",
      deadline: "2020-01-01T01:00:00.000Z",
    }),
    { ...defaults, minNoticeHours: 12 }
  ).decision,
  "accept"
);

const now = new Date("2026-06-16T12:00:00.000Z");
const capped = previewDecisions(
  [
    listing({ id: "a", firstSeenAt: "2026-06-15T02:00:00.000Z", payout: 80, travelTime: 20 }),
    listing({ id: "b", firstSeenAt: "2026-06-15T03:00:00.000Z", payout: 80, travelTime: 20 }),
    listing({ id: "c", firstSeenAt: "2026-06-15T04:30:00.000Z", payout: 80, travelTime: 20 }),
    listing({ id: "old", firstSeenAt: "2026-01-01T00:00:00.000Z", payout: 80, travelTime: 20 }),
  ],
  { ...defaults, dailyAcceptCap: 1 },
  now
);
assert.equal(capped.considered, 3);
assert.equal(capped.wouldAccept, 2);
assert.equal(capped.reasons.daily_cap, 1);
const byId = Object.fromEntries(capped.samples.map((sample) => [sample.id, sample.reason]));
assert.equal(byId.a, null);
assert.equal(byId.b, "daily_cap");
assert.equal(byId.c, null);

const negative = validateBotSettings({ ...defaults, minPayoutUsd: -5 });
assert.equal(negative.ok, false);
assert.equal(negative.errors.some((error) => error.field === "minPayoutUsd"), true);

const lowLongTrip = validateBotSettings({ ...defaults, longTripMinPayoutUsd: 10 });
assert.equal(lowLongTrip.ok, false);

const blankMax = validateBotSettings({ ...defaults, maxDriveMinutes: "", dailyAcceptCap: null, minNoticeHours: "" });
assert.equal(blankMax.ok, true);
assert.equal(blankMax.settings.maxDriveMinutes, null);
assert.equal(blankMax.settings.homeAddress, defaults.homeAddress);

const huge = validateBotSettings({ ...defaults, longTripMinutes: 5000, maxDriveMinutes: 0 });
assert.equal(huge.ok, false);

assert.equal(homeAddressChanged("11205 Keystone Avenue, Clinton, MD", "  11205   Keystone Avenue, Clinton, MD "), false);
assert.equal(homeAddressChanged(defaults.homeAddress, "1 Main Street, Waldorf, MD"), true);
assert.equal(sameHomePin(defaults, { homeLat: "38.737679", homeLng: -76.894043 }), true);
assert.equal(sameHomePin(defaults, { homeLat: 39, homeLng: -77 }), false);

assert.deepEqual(classifyHomePin({ addressChanged: false, pinSource: "none", samePin: true }), { action: "keep" });
assert.deepEqual(classifyHomePin({ addressChanged: true, pinSource: "place", samePin: true }), { action: "use-client" });
assert.deepEqual(classifyHomePin({ addressChanged: true, pinSource: "manual", samePin: false }), { action: "use-client" });
assert.equal(classifyHomePin({ addressChanged: true, pinSource: "manual", samePin: true }).message, "Those coordinates match the saved pin. Enter the coordinates for the new address.");
assert.deepEqual(classifyHomePin({ addressChanged: true, pinSource: "none", samePin: false }), { action: "geocode" });
assert.equal(classifyHomePin({ addressChanged: false, pinSource: "saved", samePin: true }).action, "keep");

const suggestions = suggestionsFromAutocomplete({
  suggestions: [
    {
      placePrediction: {
        placeId: "ChIJkeystone",
        text: { text: "11205 Keystone Avenue, Clinton, MD, USA" },
        structuredFormat: {
          mainText: { text: "11205 Keystone Avenue" },
          secondaryText: { text: "Clinton, MD, USA" },
        },
      },
    },
    { placePrediction: { placeId: "bad id", text: { text: "skip" } } },
  ],
});
assert.equal(suggestions.length, 1);
assert.equal(suggestions[0].mainText, "11205 Keystone Avenue");
assert.deepEqual(
  pinFromPlaceDetails({
    shortFormattedAddress: "11205 Keystone Ave, Clinton, MD 20735",
    formattedAddress: "11205 Keystone Avenue, Clinton, MD 20735, USA",
    location: { latitude: 38.737679, longitude: -76.894043 },
  }),
  {
    formattedAddress: "11205 Keystone Ave, Clinton, MD 20735",
    lat: 38.737679,
    lng: -76.894043,
  }
);
assert.equal(pinFromPlaceDetails({ formattedAddress: "no pin" }), null);
assert.equal(placesError("no_key").body.code, "search_unavailable");
assert.equal(placesError("network").body.message.includes("coordinates"), true);
assert.equal(HOME_PIN_REJECTED.includes("suggestions"), true);

const sql = fs.readFileSync(new URL("../supabase/migrations/20261013180000_bot_settings.sql", import.meta.url), "utf8");
for (const column of [
  "id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1)",
  "auto_accept_enabled boolean NOT NULL DEFAULT true",
  "min_payout_usd numeric NOT NULL DEFAULT 50",
  "long_trip_minutes int NOT NULL DEFAULT 60",
  "long_trip_min_payout_usd numeric NOT NULL DEFAULT 100",
  "max_drive_minutes int",
  "home_address text NOT NULL DEFAULT '11205 Keystone Avenue, Clinton, MD'",
  "home_lat double precision NOT NULL DEFAULT 38.737679",
  "home_lng double precision NOT NULL DEFAULT -76.894043",
  "daily_accept_cap int",
  "min_notice_hours int",
  "updated_at timestamptz NOT NULL DEFAULT now()",
  "updated_by text",
]) {
  assert.equal(sql.includes(column), true, column);
}
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /is_dashboard_admin\(\)/);
assert.match(sql, /GRANT ALL ON TABLE public\.bot_settings TO service_role/);
assert.match(sql, /GRANT SELECT, UPDATE ON TABLE public\.bot_settings TO authenticated/);
assert.match(sql, /INSERT INTO public\.bot_settings \(id\)/);
assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i);

assert.equal(destinationForListing({ latitude: 0, longitude: 0, address: "1 Main St" }).kind, "address");
assert.equal(destinationForListing({ latitude: null, longitude: null, address: "1 Main St" }).kind, "address");
assert.equal(destinationForListing({ latitude: "0.000000", longitude: "0", address: "1 Main St" }).kind, "address");
assert.equal(destinationForListing({ latitude: 38.8, longitude: -76.8, address: "1 Main St" }).kind, "coordinates");
assert.equal(destinationForListing({ address: "   " }).kind, "missing");
assert.equal(minutesFromDuration("3720s"), 62);
assert.equal(minutesFromDuration("0s"), 0);
assert.equal(minutesFromDuration("nope"), null);

const origin = { lat: 38.737679, lng: -76.894043 };
clearDriveTimeCache();
const far = {
  id: "far",
  payout: 80,
  travelTime: 20,
  firstSeenAt: "2026-06-15T16:00:00.000Z",
  address: "Far Farm",
  latitude: 0,
  longitude: 0,
};
const draftedLookup = await computePreviewDriveTimes(origin, [far], {
  apiKey: "test",
  fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.destination.address, "Far Farm");
    assert.equal(body.destination.location, undefined);
    assert.equal(options.headers["X-Goog-FieldMask"], "routes.duration");
    return { ok: true, status: 200, json: async () => ({ routes: [{ duration: "5400s" }] }) };
  },
});
assert.equal(draftedLookup.calls, 1);
assert.equal(draftedLookup.byId.get("far").minutes, 90);
const drafted = listingsWithDraftDrives([far], draftedLookup.byId);
assert.equal(far.travelTime, 20);
assert.equal(drafted[0].travelTime, 90);
assert.equal(decideListing(drafted[0], defaults).reason, "long_trip_payout");
const cached = await computePreviewDriveTimes(origin, [far], {
  apiKey: "test",
  fetchImpl: async () => {
    throw new Error("cache should answer");
  },
});
assert.equal(cached.calls, 0);
assert.equal(cached.cacheHits, 1);
assert.equal(storedDrivesMatch([far], draftedLookup.byId), false);
assert.equal(
  storedDrivesMatch([{ id: "far", travelTime: 90 }], draftedLookup.byId),
  true
);
assert.equal(
  storedDrivesMatch([{ id: "far", travelTime: 20 }], new Map([["far", { minutes: null, source: "missing" }]])),
  null
);

clearDriveTimeCache();
let coordinateBody;
await computePreviewDriveTimes(origin, [{
  id: "pin",
  address: "Do not use this",
  latitude: 39.1,
  longitude: -76.8,
  firstSeenAt: "2026-06-15T16:00:00.000Z",
  travelTime: 5,
}], {
  apiKey: "test",
  fetchImpl: async (_url, options) => {
    coordinateBody = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ routes: [{ duration: "120s" }] }) };
  },
});
assert.equal(coordinateBody.destination.location.latLng.latitude, 39.1);
assert.equal(coordinateBody.destination.location.latLng.longitude, -76.8);
assert.equal(coordinateBody.destination.address, undefined);

clearDriveTimeCache();
let cappedCalls = 0;
const many = Array.from({ length: MAX_ROUTE_CALLS + 1 }, (_, index) => ({
  id: `row-${index}`,
  address: `${index} Oak Street, Clinton, MD`,
  latitude: null,
  longitude: null,
  travelTime: 15,
  firstSeenAt: new Date(Date.UTC(2026, 5, 1, 0, index)).toISOString(),
}));
const cappedDrives = await computePreviewDriveTimes(origin, many, {
  apiKey: "test",
  fetchImpl: async () => {
    cappedCalls += 1;
    return { ok: true, status: 200, json: async () => ({ routes: [{ duration: "600s" }] }) };
  },
});
assert.equal(cappedCalls, MAX_ROUTE_CALLS);
assert.equal(cappedDrives.capped, true);
assert.equal(cappedDrives.byId.get("row-0").source, "capped");
assert.equal(cappedDrives.byId.get(`row-${MAX_ROUTE_CALLS}`).minutes, 10);
assert.equal(listingsWithDraftDrives(many, cappedDrives.byId)[0].travelTime, 15);

clearDriveTimeCache();
const noKey = await computePreviewDriveTimes(origin, [far], {
  apiKey: null,
  fetchImpl: async () => {
    throw new Error("should not call");
  },
});
assert.equal(noKey.ok, false);
assert.equal(noKey.reason, "no_key");

const driveRoute = fs.readFileSync(new URL("../pages/api/admin/bot-settings/drive-times.js", import.meta.url), "utf8");
assert.match(driveRoute, /requireAdmin/);
assert.doesNotMatch(driveRoute, /\.update\(|\.upsert\(|\.insert\(/);

console.log("Bot rules checks passed.");
