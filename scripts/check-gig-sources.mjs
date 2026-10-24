import assert from "node:assert/strict";
import fs from "node:fs";

const {
  GIG_SOURCE_CATALOG,
  GIG_SOURCES_MIGRATION,
  applyEnabled,
  displayNameFor,
  fetchDroneGigsHealth,
  isMissingGigSourcesTable,
  knownSourceKeys,
  loadGigSourceView,
  parseSourceToggle,
  presentSources,
  previewPageAllowed,
  previewSources,
  profileSyncRequestFields,
  requestsProfileSync,
  zeitviewHealthFromPayload,
} = await import("../libs/gigSources.js");

const NOW = new Date("2026-10-24T00:12:30.000Z");

function liveLike(overrides = {}) {
  return {
    status: "ok",
    lastWatchError: null,
    watchExpiration: "2026-10-31T00:06:59.728Z",
    gmailPoll: {
      enabled: true,
      intervalMs: 300000,
      count: 2,
      lastPollAt: "2026-10-24T00:12:00.049Z",
      lastPollResult: { ok: true, trigger: "poll", found: 4, queued: 0 },
    },
    recentMissionOutcomes: [],
    unclearAccepts: [],
    acceptFailures: [],
    zeitviewProfileSync: {
      state: "ok",
      lastResult: "ok",
      error: null,
      drift: false,
    },
    driveTimeBackfill: {
      state: "finished",
      error: null,
      failed: 0,
      unlocated: 1,
      failures: [{ externalMissionId: "DBM1", reason: "No address or coordinates" }],
    },
    ...overrides,
  };
}

function zeitview(rows, payload, liveOk = true) {
  return presentSources(rows, { live: payload, liveOk, now: NOW }).find((source) => source.key === "zeitview");
}

const healthy = zeitview([], liveLike());
assert.equal(healthy.name, "Zeitview");
assert.equal(healthy.enabled, true);
assert.equal(healthy.dot, "green");
assert.equal(healthy.statusLabel, "OK");
assert.match(healthy.statusText, /Grabbing Zeitview gigs/);
assert.equal(healthy.logoSrc, "/brand/sources/zeitview.svg");
assert.equal(healthy.persisted, false);

assert.equal(zeitviewHealthFromPayload(liveLike(), NOW).level, "ok");
assert.equal(
  zeitview([{ sourceKey: "zeitview", enabled: false }], liveLike({ acceptFailures: [{ id: "1" }] })).dot,
  "gray"
);
assert.equal(
  zeitview([{ sourceKey: "zeitview", enabled: false }], liveLike({ acceptFailures: [{ id: "1" }] })).health.level,
  "down"
);
assert.match(
  zeitview([{ sourceKey: "zeitview", enabled: false }], liveLike()).statusText,
  /will not pull gigs from Zeitview/
);

assert.equal(zeitview([], liveLike({ status: "down" })).dot, "red");
assert.equal(zeitview([], liveLike({ lastWatchError: "watch broke" })).statusText, "watch broke");
assert.match(zeitview([], liveLike({ gmailPoll: { ...liveLike().gmailPoll, enabled: false } })).statusText, /poll is off/);
assert.match(
  zeitview([], liveLike({
    gmailPoll: { ...liveLike().gmailPoll, lastPollResult: { ok: false, error: "inbox auth failed" } },
  })).statusText,
  /inbox auth failed/
);
assert.match(
  zeitview([], liveLike({
    gmailPoll: { ...liveLike().gmailPoll, lastPollAt: "2026-10-23T23:40:00.000Z" },
  })).statusText,
  /stale/
);
assert.equal(
  zeitview([], liveLike({ watchExpiration: "2026-10-24T00:00:00.000Z" })).dot,
  "red"
);
assert.match(zeitview([], liveLike({ acceptFailures: [{ externalMissionId: "DBM9" }] })).statusText, /accept failed/);
assert.match(
  zeitview([], liveLike({
    zeitviewProfileSync: { state: "failed", lastResult: "failed", error: "script needs updating", drift: false },
  })).statusText,
  /script needs updating/
);

assert.match(
  zeitview([], liveLike({
    gmailPoll: { ...liveLike().gmailPoll, lastPollAt: "2026-10-24T00:02:00.000Z" },
  })).statusText,
  /running late/
);
assert.match(
  zeitview([], liveLike({ zeitviewProfileSync: { state: "ok", lastResult: "ok", error: null, drift: true } })).statusText,
  /does not match/
);
assert.match(zeitview([], liveLike({ unclearAccepts: [{ id: "u1" }] })).statusText, /needs a look/);
assert.match(
  zeitview([], liveLike({ recentMissionOutcomes: [{ ok: false }] })).statusText,
  /outcome needs fixing/
);
assert.equal(
  zeitviewHealthFromPayload(liveLike({ recentMissionOutcomes: [{ status: "accepted" }] }), NOW).level,
  "ok"
);
assert.match(
  zeitview([], liveLike({ driveTimeBackfill: { error: null, failed: 2 } })).statusText,
  /Drive times/
);
assert.equal(zeitviewHealthFromPayload(liveLike(), NOW).level, "ok");
assert.match(
  zeitview([], liveLike({ watchExpiration: "2026-10-24T12:00:00.000Z" })).statusText,
  /expires within a day/
);
assert.equal(zeitview([], null, false).dot, "orange");
assert.match(zeitview([], null, false).statusText, /Could not reach/);
assert.equal(
  zeitview(
    [{ sourceKey: "zeitview", enabled: true, lastHealth: "down", lastError: "stored watch broke" }],
    null,
    false
  ).statusText,
  "stored watch broke"
);
assert.equal(
  zeitview(
    [{ sourceKey: "zeitview", enabled: true, lastHealth: "ok", lastError: "ignore on success" }],
    null,
    false
  ).dot,
  "green"
);

const withExtra = presentSources(
  [
    { sourceKey: "zeitview", enabled: true, displayName: "Zeitview" },
    { sourceKey: "acme", displayName: "Acme Air", enabled: true, lastHealth: "ok" },
    { sourceKey: "other", displayName: "Other Feed", enabled: true },
  ],
  { live: liveLike(), liveOk: true, now: NOW }
);
assert.deepEqual(withExtra.map((source) => source.key), ["zeitview", "flyguys", "droners", "acme", "other"]);
const acme = withExtra.find((source) => source.key === "acme");
const other = withExtra.find((source) => source.key === "other");
assert.equal(acme.dot, "green");
assert.equal(acme.logoSrc, null);
assert.equal(other.dot, "orange");
assert.match(other.statusText, /No status/);
assert.equal(applyEnabled(acme, false).dot, "gray");
assert.equal(applyEnabled(acme, false).health.level, "ok");

assert.deepEqual(knownSourceKeys([]), ["zeitview", "flyguys", "droners"]);
assert.equal(displayNameFor("zeitview", []), "Zeitview");
assert.equal(displayNameFor("flyguys", []), "FlyGuys");
assert.equal(displayNameFor("droners", []), "Droners.io");
const defaults = presentSources([], { live: liveLike(), liveOk: true, now: NOW });
assert.equal(defaults.find((source) => source.key === "zeitview").enabled, true);
assert.equal(defaults.find((source) => source.key === "flyguys").enabled, false);
assert.equal(defaults.find((source) => source.key === "droners").enabled, false);
assert.match(defaults.find((source) => source.key === "droners").ruleNote, /Cloudflare blocks the bot/);
assert.equal(defaults.find((source) => source.key === "droners").sync.text, "Manual, update on droners.io");
assert.equal(defaults.find((source) => source.key === "droners").sync.state, "manual");
assert.equal(defaults.find((source) => source.key === "droners").dot, "blue");
assert.equal(defaults.find((source) => source.key === "droners").statusLabel, "Manual");
assert.equal(
  defaults.find((source) => source.key === "droners").statusText,
  "Job alerts by email. Settings managed on droners.io."
);
assert.doesNotMatch(defaults.find((source) => source.key === "droners").statusText, /No status|Needs a fix/);
assert.match(defaults.find((source) => source.key === "flyguys").ruleNote, /nothing to sync/);
const legacySynced = presentSources([], {
  live: liveLike(),
  liveOk: true,
  now: NOW,
  legacyZeitviewSync: {
    result: "ok",
    syncedAt: "2026-10-24T15:00:00.000Z",
    observed: { street: "11205 Keystone Ave", city: "Clinton", travel_distance: 100 },
  },
}).find((source) => source.key === "zeitview");
assert.match(legacySynced.sync.text, /100 mi from 11205 Keystone Ave, Clinton/);
const storedSync = presentSources(
  [
    {
      sourceKey: "flyguys",
      enabled: false,
      displayName: "FlyGuys",
      profileSyncAvailable: true,
      profileSyncResult: "nothing",
      profileSyncAt: "2026-10-24T15:00:00.000Z",
    },
    {
      sourceKey: "droners",
      enabled: false,
      displayName: "Droners.io",
      profileSyncAvailable: true,
      profileSyncResult: "failed",
      profileSyncError: "Account Settings did not save.",
      profileSyncAt: "2026-10-24T15:00:00.000Z",
    },
  ],
  { live: liveLike(), liveOk: true, now: NOW }
);
assert.equal(storedSync.find((source) => source.key === "flyguys").sync.text, "Nothing to sync.");
assert.equal(storedSync.find((source) => source.key === "droners").sync.state, "manual");
assert.equal(storedSync.find((source) => source.key === "droners").sync.text, "Manual, update on droners.io");
assert.equal(storedSync.find((source) => source.key === "droners").sync.title, undefined);
const dronersNothing = presentSources(
  [
    {
      sourceKey: "droners",
      enabled: true,
      displayName: "Droners.io",
      profileSyncAvailable: true,
      profileSyncResult: "nothing",
      profileSyncAt: "2026-10-24T15:00:00.000Z",
    },
  ],
  { live: liveLike(), liveOk: true, now: NOW }
).find((source) => source.key === "droners");
assert.equal(dronersNothing.sync.text, "Manual, update on droners.io");
assert.notEqual(dronersNothing.sync.state, "nothing");
assert.equal(requestsProfileSync("droners"), false);
assert.equal(requestsProfileSync("zeitview"), true);
assert.equal(requestsProfileSync("flyguys"), true);
assert.deepEqual(profileSyncRequestFields("droners", true, NOW), {});
assert.deepEqual(profileSyncRequestFields("zeitview", false, NOW), {});
assert.deepEqual(profileSyncRequestFields("zeitview", true, NOW), {
  profile_sync_requested_at: NOW.toISOString(),
});
assert.deepEqual(profileSyncRequestFields("flyguys", true, NOW), {
  profile_sync_requested_at: NOW.toISOString(),
});
assert.deepEqual(profileSyncRequestFields("flyguys", false, NOW), {});
const manualDespiteHealth = presentSources(
  [
    {
      sourceKey: "droners",
      enabled: true,
      displayName: "Droners.io",
      lastHealth: "down",
      lastError: "Cloudflare blocked the profile page.",
      profileSyncAvailable: true,
      profileSyncResult: "failed",
      profileSyncError: "Account Settings did not save.",
      profileSyncAt: "2026-10-24T15:00:00.000Z",
    },
  ],
  { live: liveLike(), liveOk: true, now: NOW }
).find((source) => source.key === "droners");
assert.equal(manualDespiteHealth.enabled, true);
assert.equal(manualDespiteHealth.dot, "blue");
assert.equal(manualDespiteHealth.statusLabel, "Manual");
assert.equal(manualDespiteHealth.statusText, "Job alerts by email. Settings managed on droners.io.");
assert.notEqual(manualDespiteHealth.sync.state, "failed");
assert.equal(manualDespiteHealth.health.level, "manual");
const pendingOff = presentSources(
  [
    {
      sourceKey: "flyguys",
      enabled: false,
      displayName: "FlyGuys",
      profileSyncAvailable: true,
      profileSyncRequestedAt: "2026-10-24T15:30:00.000Z",
    },
  ],
  { live: liveLike(), liveOk: true, now: NOW }
).find((source) => source.key === "flyguys");
assert.equal(pendingOff.enabled, false);
assert.equal(pendingOff.dot, "gray");
assert.equal(pendingOff.sync, null);
const pendingOn = presentSources(
  [
    {
      sourceKey: "flyguys",
      enabled: true,
      displayName: "FlyGuys",
      profileSyncAvailable: true,
      profileSyncRequestedAt: "2026-10-24T15:30:00.000Z",
    },
  ],
  { live: liveLike(), liveOk: true, now: NOW }
).find((source) => source.key === "flyguys");
assert.equal(pendingOn.sync.state, "pending");
assert.equal(pendingOn.sync.text, "Sync requested. Waiting for the drone-gigs bot.");
assert.equal(applyEnabled(pendingOn, false).sync, null);
assert.equal(applyEnabled(pendingOn, false).enabled, false);
assert.equal(displayNameFor("acme", [{ sourceKey: "acme", displayName: "Acme Air" }]), "Acme Air");
assert.equal(parseSourceToggle({ sourceKey: "zeitview", enabled: false }, ["zeitview"]).ok, true);
assert.equal(parseSourceToggle({ sourceKey: "nope", enabled: true }, ["zeitview"]).ok, false);
assert.equal(parseSourceToggle({ sourceKey: "zeitview", enabled: "false" }, ["zeitview"]).ok, false);
assert.equal(isMissingGigSourcesTable({ code: "PGRST205", message: "gig_sources schema cache" }), true);
assert.equal(isMissingGigSourcesTable({ code: "42P01" }), true);
assert.equal(isMissingGigSourcesTable({ message: "permission denied" }), false);

for (const state of ["green", "orange", "red", "disabled"]) {
  const [source] = previewSources(state, NOW);
  assert.equal(source.name, "Zeitview");
  assert.equal(source.dot, state === "disabled" ? "gray" : state);
  assert.equal(source.enabled, state !== "disabled");
}
assert.equal(GIG_SOURCE_CATALOG[0].name, "Zeitview");

assert.equal(previewPageAllowed({ VERCEL_ENV: "production", NODE_ENV: "production" }), false);
assert.equal(previewPageAllowed({ VERCEL_ENV: "preview", NODE_ENV: "production" }), true);
assert.equal(previewPageAllowed({ NODE_ENV: "development" }), true);

const fetched = await fetchDroneGigsHealth({
  fetchImpl: async () => ({ ok: true, json: async () => liveLike() }),
});
assert.equal(fetched.ok, true);
const failed = await fetchDroneGigsHealth({
  fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
});
assert.equal(failed.ok, false);
const thrown = await fetchDroneGigsHealth({
  fetchImpl: async () => {
    throw new Error("offline");
  },
});
assert.equal(thrown.ok, false);

let calls = 0;
const view = await loadGigSourceView({
  rows: [],
  tableReady: false,
  now: NOW,
  fetchImpl: async () => {
    calls += 1;
    return { ok: true, json: async () => liveLike() };
  },
});
assert.equal(calls, 1);
assert.equal(view.tableReady, false);
assert.equal(view.migration, GIG_SOURCES_MIGRATION);
assert.equal(view.sources[0].dot, "green");
assert.equal(view.sources[0].enabled, true);

const migration = fs.readFileSync(new URL(`../${GIG_SOURCES_MIGRATION}`, import.meta.url), "utf8");
assert.match(migration, /CREATE TABLE public\.gig_sources/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /source_key text PRIMARY KEY/);
assert.match(migration, /enabled boolean NOT NULL DEFAULT true/);
assert.match(migration, /last_health/);
assert.match(migration, /last_success_at/);
assert.match(migration, /last_error/);
assert.match(migration, /updated_at/);
assert.match(migration, /'zeitview', 'Zeitview', true/);

const sharedMigration = fs.readFileSync(
  new URL("../supabase/migrations/20261024200000_shared_bot_rules.sql", import.meta.url),
  "utf8"
);
assert.match(sharedMigration, /'flyguys', 'FlyGuys', false/);
assert.match(sharedMigration, /'droners', 'Droners.io', false/);
assert.match(sharedMigration, /bookings_source_check/);
assert.match(sharedMigration, /'customer', 'zeitview', 'manual', 'flyguys', 'droners'/);
assert.match(sharedMigration, /travel_radius_miles/);
assert.doesNotMatch(sharedMigration, /DROP COLUMN/);
assert.match(migration, /is_dashboard_admin\(\)/);
assert.match(migration, /gig_sources_admin_select/);
assert.match(migration, /gig_sources_admin_update/);
assert.doesNotMatch(migration, /TO anon/);
assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);

const sourceDb = fs.readFileSync(new URL("../libs/db/gigSources.js", import.meta.url), "utf8");
assert.match(sourceDb, /profileSyncRequestFields\(sourceKey, enabled\)/);
assert.match(sourceDb, /\.neq\("source_key", "droners"\)/);
assert.match(sourceDb, /requestsProfileSync\("droners"\)/);
assert.match(sourceDb, /\.eq\("enabled", true\)/);

const route = fs.readFileSync(new URL("../pages/api/admin/gig-sources/index.js", import.meta.url), "utf8");
assert.match(route, /requireAdmin/);
assert.match(route, /\["GET", "PATCH"\]/);
assert.doesNotMatch(route, /gmailPoll|lastWatchError|acceptFailures/);

const ui = fs.readFileSync(new URL("../components/admin/ConnectedSourcesSection.jsx", import.meta.url), "utf8");
assert.match(ui, /sources\.map/);
assert.match(ui, /"Enabled"/);
assert.match(ui, /"Disabled"/);
assert.match(ui, /role="switch"/);
assert.match(ui, /\$\{source\.name\} \$\{source\.enabled \? "enabled" : "disabled"\}/);
assert.match(ui, /h-6 w-11/);
assert.match(ui, /left-0\.5 top-0\.5 h-5 w-5/);
assert.match(ui, /source\.enabled \? "translate-x-5" : "translate-x-0"/);
assert.match(ui, /data-source-summary/);
assert.match(ui, /data-rule-note/);
assert.match(ui, /data-source-sync/);
assert.match(ui, /bg-blue-500/);
assert.match(ui, /Blue means you update that site yourself/);
assert.match(ui, /role="alert"/);
assert.doesNotMatch(ui, /w-full cursor-pointer items-center justify-between/);
assert.doesNotMatch(ui, /Zeitview/);

const rules = fs.readFileSync(new URL("../components/admin/BotRulesSection.jsx", import.meta.url), "utf8");
assert.match(rules, /<ConnectedSourcesSection/);

const logo = fs.readFileSync(new URL("../public/brand/sources/zeitview.svg", import.meta.url), "utf8");
assert.match(logo, /<svg/);
assert.match(logo, /Placeholder/);
for (const file of ["flyguys.svg", "droners.svg"]) {
  const mark = fs.readFileSync(new URL(`../public/brand/sources/${file}`, import.meta.url), "utf8");
  assert.match(mark, /<svg/);
  assert.match(mark, /Placeholder/);
}

console.log("Connected source checks passed.");
