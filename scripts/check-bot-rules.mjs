import assert from "node:assert/strict";
import fs from "node:fs";

const {
  decideListing,
  HOME_PIN_REJECTED,
  classifyHomePin,
  homeAddressChanged,
  explainListing,
  previewDecisions,
  sameHomePin,
  validateBotSettings,
  DEFAULT_BOT_SETTINGS,
  describeProfileSync,
  legacyZeitviewSyncFromRow,
  radiusColumnsForSave,
  snapZeitviewRadius,
  syncObservedMiles,
  syncObservedPlace,
  travelRadiusFromRow,
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
assert.deepEqual(capped.samples.find((sample) => sample.id === "a").failures, []);
assert.deepEqual(
  capped.samples.find((sample) => sample.id === "b").failures.map((failure) => failure.code),
  ["daily_cap"]
);

const stackedRules = {
  ...defaults,
  minPayoutUsd: 50,
  longTripMinutes: 60,
  longTripMinPayoutUsd: 100,
  maxDriveMinutes: 70,
  minNoticeHours: 12,
  dailyAcceptCap: 1,
};
const stacked = listing({
  id: "stacked",
  payout: 40,
  travelTime: 75,
  firstSeenAt: "2026-06-15T20:00:00.000Z",
  rawDetail: { text: "06/15/2026 06:00PM\nYou must arrive on time" },
});
assert.equal(decideListing(stacked, stackedRules).reason, "payout_below_minimum");
assert.equal(decideListing(stacked, { ...stackedRules, autoAcceptEnabled: false }).reason, "auto_accept_off");
const stackedPreview = previewDecisions(
  [
    listing({ id: "opener", firstSeenAt: "2026-06-15T16:00:00.000Z", payout: 200, travelTime: 10 }),
    stacked,
  ],
  stackedRules,
  new Date("2026-06-16T12:00:00.000Z")
);
const stackedRow = stackedPreview.samples.find((sample) => sample.id === "stacked");
assert.equal(stackedRow.reason, "payout_below_minimum");
assert.equal(stackedRow.decision, "decline");
assert.deepEqual(
  stackedRow.failures.map((failure) => failure.text),
  [
    "Pays $40, below your $50 minimum",
    "This drive is 75 minutes, past your maximum of 70 minutes.",
    "Pays $40, but drives of an hour or more need at least $100 (this one is 75 min)",
    "The flight is 2 hours away, short of your 12 hours notice.",
    "Today's cap of 1 accepted mission is already filled.",
  ]
);
const paysEighty = explainListing(
  listing({ payout: 80, travelTime: 75 }),
  { ...defaults, longTripMinutes: 60, longTripMinPayoutUsd: 100 }
);
assert.deepEqual(
  paysEighty.map((failure) => failure.text),
  ["Pays $80, but drives of an hour or more need at least $100 (this one is 75 min)"]
);
const paysSeventy = explainListing(
  listing({ payout: 70, travelTime: 60 }),
  { ...defaults, longTripMinutes: 60, longTripMinPayoutUsd: 100, minPayoutUsd: 50 }
);
assert.deepEqual(
  paysSeventy.map((failure) => failure.text),
  ["Pays $70, but drives of an hour or more need at least $100 (this one is 60 min)"]
);
const withUnknownDrive = explainListing(
  listing({ payout: 40, travelTime: null }),
  defaults
);
assert.equal(decideListing(listing({ payout: 40, travelTime: null }), defaults).reason, "payout_below_minimum");
assert.deepEqual(
  withUnknownDrive.map((failure) => failure.code),
  ["payout_below_minimum", "drive_time_missing"]
);
assert.equal(withUnknownDrive.find((failure) => failure.code === "drive_time_missing").tone, "unsure");
const autoOff = explainListing(stacked, { ...stackedRules, autoAcceptEnabled: false });
assert.equal(autoOff[0].text, "Auto-accept is off, so the bot would not take it.");
assert.equal(autoOff.some((failure) => failure.code === "payout_below_minimum"), true);
assert.equal(autoOff.some((failure) => failure.code === "too_little_notice"), true);

const negative = validateBotSettings({ ...defaults, minPayoutUsd: -5 });
assert.equal(negative.ok, false);
assert.equal(negative.errors.some((error) => error.field === "minPayoutUsd"), true);

const lowLongTrip = validateBotSettings({ ...defaults, longTripMinPayoutUsd: 10 });
assert.equal(lowLongTrip.ok, false);

const blankMax = validateBotSettings({ ...defaults, maxDriveMinutes: "", dailyAcceptCap: null, minNoticeHours: "" });
assert.equal(blankMax.ok, true);
assert.equal(blankMax.settings.maxDriveMinutes, null);
assert.equal(blankMax.settings.homeAddress, defaults.homeAddress);
assert.equal(Object.prototype.hasOwnProperty.call(blankMax.settings, "travelRadiusMiles"), false);
assert.deepEqual(radiusColumnsForSave(blankMax.settings), {});

const keepRadius = validateBotSettings({ ...defaults, travelRadiusMiles: "" });
assert.equal(keepRadius.ok, true);
assert.equal(keepRadius.settings.travelRadiusMiles, null);
assert.deepEqual(radiusColumnsForSave(keepRadius.settings), { travel_radius_miles: null });
assert.deepEqual(radiusColumnsForSave(keepRadius.settings, { hasTravelRadiusColumn: false }), {
  zeitview_radius_miles: null,
});

const sharedRadius = validateBotSettings({ ...defaults, travelRadiusMiles: 100 });
assert.equal(sharedRadius.ok, true);
assert.equal(sharedRadius.settings.travelRadiusMiles, 100);
assert.deepEqual(radiusColumnsForSave(sharedRadius.settings), { travel_radius_miles: 100 });
assert.equal(Object.prototype.hasOwnProperty.call(radiusColumnsForSave(sharedRadius.settings), "zeitview_radius_miles"), false);

const exactMiles = validateBotSettings({ ...defaults, travelRadiusMiles: 37 });
assert.equal(exactMiles.ok, true);
assert.equal(exactMiles.settings.travelRadiusMiles, 37);
assert.equal(snapZeitviewRadius(37), 25);
assert.equal(snapZeitviewRadius(80), 100);
assert.equal(snapZeitviewRadius(100), 100);
assert.equal(snapZeitviewRadius("50"), 50);
assert.equal(snapZeitviewRadius("keep current"), null);
assert.deepEqual(radiusColumnsForSave(exactMiles.settings, { hasTravelRadiusColumn: false }), {
  zeitview_radius_miles: 25,
});

const badRadius = validateBotSettings({ ...defaults, travelRadiusMiles: "nearby" });
assert.equal(badRadius.ok, false);
assert.equal(badRadius.errors.some((error) => error.field === "travelRadiusMiles"), true);

assert.equal(travelRadiusFromRow({ home_address: defaults.homeAddress }).travelRadiusAvailable, false);
assert.equal(travelRadiusFromRow({ travel_radius_miles: 100 }).travelRadiusMiles, 100);
assert.equal(travelRadiusFromRow({ travel_radius_miles: null }).travelRadiusMiles, null);
assert.equal(
  travelRadiusFromRow({ travel_radius_miles: 80, zeitview_radius_miles: 100 }).travelRadiusMiles,
  80
);
assert.equal(travelRadiusFromRow({ zeitview_radius_miles: "100" }).travelRadiusMiles, 100);
assert.equal(travelRadiusFromRow({ zeitview_radius_miles: "100" }).travelRadiusLegacy, true);
assert.equal(describeProfileSync("Zeitview", null), null);

const observed = {
  street: "11205 Keystone Ave",
  city: "Clinton",
  travel_distance: 100,
};
assert.equal(syncObservedPlace(observed), "11205 Keystone Ave, Clinton");
assert.equal(syncObservedMiles({ address: { street: "11205 Keystone Ave", city: "Clinton" }, travel_distance: "100 mi" }), "100");
const legacy = legacyZeitviewSyncFromRow({
  zeitview_last_synced_at: "2026-10-14T05:00:00.000Z",
  zeitview_last_result: "ok",
  zeitview_last_error: null,
  zeitview_observed: observed,
});
assert.equal(
  describeProfileSync("Zeitview", legacy, () => "Oct 14, 1:00 AM").text,
  "Synced Oct 14, 1:00 AM: 100 mi from 11205 Keystone Ave, Clinton"
);
assert.equal(
  describeProfileSync("Zeitview", { ...legacy, observed: { travel_distance: 100 } }, () => "Oct 14, 1:00 AM").text,
  "Synced Oct 14, 1:00 AM."
);
const failedSync = describeProfileSync("Zeitview", {
  result: "failed",
  error: "profile form changed",
  syncedAt: "2026-10-14T05:00:00.000Z",
});
assert.equal(failedSync.title, "Zeitview sync broke, script needs updating");
assert.equal(failedSync.detail, "profile form changed");
assert.equal(failedSync.state, "failed");
assert.equal(describeProfileSync("FlyGuys", { result: "nothing", syncedAt: "2026-10-14T05:00:00.000Z" }).text, "Nothing to sync.");
assert.equal(legacyZeitviewSyncFromRow({ home_address: defaults.homeAddress }), null);

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

const zeitviewSql = fs.readFileSync(
  new URL("../supabase/migrations/20261014020000_bot_settings_zeitview.sql", import.meta.url),
  "utf8"
);
for (const column of [
  "zeitview_radius_miles numeric",
  "zeitview_last_synced_at timestamptz",
  "zeitview_last_result text",
  "zeitview_last_error text",
  "zeitview_observed jsonb",
]) {
  assert.equal(zeitviewSql.includes(column), true, column);
}
assert.match(zeitviewSql, /zeitview_radius_miles IN \(10, 25, 50, 100, 200\)/);
assert.match(zeitviewSql, /zeitview_last_result IN \('ok', 'failed'\)/);
assert.doesNotMatch(zeitviewSql, /CREATE POLICY/i);
assert.doesNotMatch(zeitviewSql, /DROP POLICY/i);
assert.doesNotMatch(zeitviewSql, /TO anon/i);
assert.doesNotMatch(zeitviewSql, /USING\s*\(\s*true\s*\)/i);
assert.match(sql, /CREATE POLICY bot_settings_admin_select/);
assert.match(sql, /CREATE POLICY bot_settings_admin_update/);

const sharedSql = fs.readFileSync(
  new URL("../supabase/migrations/20261024200000_shared_bot_rules.sql", import.meta.url),
  "utf8"
);
assert.match(sharedSql, /ADD COLUMN IF NOT EXISTS travel_radius_miles numeric/);
assert.match(sharedSql, /SET travel_radius_miles = zeitview_radius_miles/);
assert.doesNotMatch(sharedSql, /DROP COLUMN[^;]*zeitview_radius_miles/);
assert.match(sharedSql, /bot_settings_keep_travel_radius/);
assert.match(sharedSql, /zeitview_radius_miles := best/);
assert.match(sharedSql, /profile_sync_result IN \('ok', 'failed', 'nothing'\)/);
assert.match(sharedSql, /bot_settings_mirror_zeitview_sync/);
assert.doesNotMatch(sharedSql, /CREATE POLICY/i);
assert.doesNotMatch(sharedSql, /USING\s*\(\s*true\s*\)/i);

const rulesUi = fs.readFileSync(new URL("../components/admin/BotRulesSection.jsx", import.meta.url), "utf8");
assert.match(rulesUi, /Travel radius/);
assert.doesNotMatch(rulesUi, /zeitview_radius_miles|zeitviewRadiusMiles|Zeitview travel radius/);
const settingsDb = fs.readFileSync(new URL("../libs/db/botSettings.js", import.meta.url), "utf8");
assert.match(settingsDb, /radiusColumnsForSave/);
assert.doesNotMatch(settingsDb, /zeitview_radius_miles/);

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
