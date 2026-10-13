import assert from "node:assert/strict";
import fs from "node:fs";

const {
  decideListing,
  homeAddressChanged,
  previewDecisions,
  sameHomePin,
  validateBotSettings,
  DEFAULT_BOT_SETTINGS,
} = await import("../libs/botRules.js");

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

console.log("Bot rules checks passed.");
