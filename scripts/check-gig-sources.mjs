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
assert.deepEqual(withExtra.map((source) => source.key), ["zeitview", "acme", "other"]);
assert.equal(withExtra[1].dot, "green");
assert.equal(withExtra[1].logoSrc, null);
assert.equal(withExtra[2].dot, "orange");
assert.match(withExtra[2].statusText, /No status/);
assert.equal(applyEnabled(withExtra[1], false).dot, "gray");
assert.equal(applyEnabled(withExtra[1], false).health.level, "ok");

assert.deepEqual(knownSourceKeys([]), ["zeitview"]);
assert.equal(displayNameFor("zeitview", []), "Zeitview");
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
assert.match(migration, /is_dashboard_admin\(\)/);
assert.match(migration, /gig_sources_admin_select/);
assert.match(migration, /gig_sources_admin_update/);
assert.doesNotMatch(migration, /TO anon/);
assert.doesNotMatch(migration, /USING\s*\(\s*true\s*\)/i);

const route = fs.readFileSync(new URL("../pages/api/admin/gig-sources/index.js", import.meta.url), "utf8");
assert.match(route, /requireAdmin/);
assert.match(route, /\["GET", "PATCH"\]/);
assert.doesNotMatch(route, /gmailPoll|lastWatchError|acceptFailures/);

const ui = fs.readFileSync(new URL("../components/admin/ConnectedSourcesSection.jsx", import.meta.url), "utf8");
assert.match(ui, /sources\.map/);
assert.match(ui, /"Enabled"/);
assert.match(ui, /"Disabled"/);
assert.match(ui, /role="switch"/);
assert.doesNotMatch(ui, /Zeitview/);

const rules = fs.readFileSync(new URL("../components/admin/BotRulesSection.jsx", import.meta.url), "utf8");
assert.match(rules, /<ConnectedSourcesSection \/>/);

const logo = fs.readFileSync(new URL("../public/brand/sources/zeitview.svg", import.meta.url), "utf8");
assert.match(logo, /<svg/);
assert.match(logo, /Placeholder/);

console.log("Connected source checks passed.");
