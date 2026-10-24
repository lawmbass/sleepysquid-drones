/**
 * Connected gig sources shown on Bot rules.
 *
 * The list is the catalog below plus any extra rows in public.gig_sources,
 * so a later source is another row. Zeitview is always present. A missing
 * row stays enabled, which is today's behavior.
 *
 * Health for Zeitview comes from the drone-gigs bot's existing health
 * document when GET {DRONE_GIGS_HEALTH_URL} succeeds (default
 * https://drone-gigs.onrender.com/health). The dashboard does not require
 * the bot to write last_health. Stored last_health / last_error /
 * last_success_at are the fallback when that request fails, and they are
 * what the bot should keep current for sources that /health does not describe.
 *
 * Zeitview dot, when the source is enabled:
 *   green (ok)       the poll is fresh and successful, nothing below fired
 *   orange (degraded) the pipeline is up but something needs a fix
 *   red (down)       the pull, the watch, profile sync, or an accept is broken
 * When enabled is false the dot is gray and the health level is ignored.
 *
 * Red if any of these are true:
 *   - status is missing or not "ok"
 *   - lastWatchError is a non-empty string
 *   - gmailPoll.enabled is false
 *   - gmailPoll.lastPollResult.ok is false
 *   - gmailPoll.lastPollAt is older than max(3 intervals, 15 minutes)
 *   - watchExpiration is already past
 *   - acceptFailures has any entry
 *   - zeitviewProfileSync.lastResult or state is "failed", or error is set
 * Orange if none of those fired and any of these are true:
 *   - gmail poll block is missing, lastPollAt is missing, or lastPollResult
 *     has not reported ok yet
 *   - lastPollAt is older than max(1.5 intervals, 6 minutes)
 *   - zeitviewProfileSync.drift is true
 *   - unclearAccepts has any entry
 *   - recentMissionOutcomes has an entry with ok/success false, a non-empty
 *     error, or status failed, error, down, or broken
 *   - driveTimeBackfill.error is set or failed > 0
 *   - watchExpiration is within 24 hours
 * driveTimeBackfill.unlocated and its failures list do not change the dot
 * when failed is 0 and error is empty. Those are listings the bot could not
 * locate, and the live bot reports them while the pull itself is fine.
 *
 * Other sources have no slice of /health yet. Their dot uses stored
 * last_health, or orange "No status for this source yet."
 */

export const GIG_SOURCES_MIGRATION = "supabase/migrations/20261024010000_gig_sources.sql";

export const DRONE_GIGS_HEALTH_URL =
  process.env.DRONE_GIGS_HEALTH_URL || "https://drone-gigs.onrender.com/health";

export const GIG_SOURCE_CATALOG = [
  {
    key: "zeitview",
    name: "Zeitview",
    logoSrc: "/brand/sources/zeitview.svg",
    summary: "Pulls gigs from Zeitview and adds them to SleepySquid bookings.",
  },
];

const SOURCE_KEY = /^[a-z][a-z0-9_]{0,40}$/;
const HEALTH_RANK = { ok: 0, degraded: 1, down: 2 };
const LATE_FLOOR_MS = 6 * 60 * 1000;
const STALE_FLOOR_MS = 15 * 60 * 1000;
const WATCH_SOON_MS = 24 * 60 * 60 * 1000;
const HEALTH_CACHE_MS = 15 * 1000;

let healthCache = { at: 0, value: null };

export function clearHealthCache() {
  healthCache = { at: 0, value: null };
}

function clip(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= 240) return text;
  return `${text.slice(0, 237)}...`;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function outcomeFailed(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.ok === false || entry.success === false) return true;
  if (text(entry.error)) return true;
  const status = text(entry.status || entry.result || entry.outcome).toLowerCase();
  return status === "failed" || status === "error" || status === "down" || status === "broken";
}

export function dotForLevel(level) {
  if (level === "ok") return "green";
  if (level === "down") return "red";
  return "orange";
}

export function statusLabelFor(dot) {
  if (dot === "green") return "OK";
  if (dot === "red") return "Broken";
  if (dot === "gray") return "Disabled";
  return "Needs a fix";
}

export function disabledExplanation(name) {
  return `The bot will not pull gigs from ${name} or add them to bookings.`;
}

export function isMissingGigSourcesTable(error) {
  const code = String(error?.code || "");
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (/gig_sources/i.test(message) && /schema cache|does not exist|could not find/i.test(message))
  );
}

export function knownSourceKeys(rows = []) {
  const keys = new Set(GIG_SOURCE_CATALOG.map((source) => source.key));
  for (const row of rows) {
    if (row?.sourceKey && SOURCE_KEY.test(row.sourceKey)) keys.add(row.sourceKey);
  }
  return [...keys];
}

export function displayNameFor(sourceKey, rows = []) {
  const catalog = GIG_SOURCE_CATALOG.find((source) => source.key === sourceKey);
  if (catalog) return catalog.name;
  const row = rows.find((item) => item?.sourceKey === sourceKey);
  const name = text(row?.displayName);
  return name || sourceKey;
}

export function parseSourceToggle(body, knownKeys) {
  const sourceKey = typeof body?.sourceKey === "string" ? body.sourceKey.trim() : "";
  if (!SOURCE_KEY.test(sourceKey) || !knownKeys.includes(sourceKey)) {
    return { ok: false, message: "Choose a connected source." };
  }
  if (typeof body?.enabled !== "boolean") {
    return { ok: false, message: "Choose enabled or disabled." };
  }
  return { ok: true, sourceKey, enabled: body.enabled };
}

function raise(state, level, summary) {
  if (HEALTH_RANK[level] > HEALTH_RANK[state.level]) {
    state.level = level;
    state.summary = summary;
  }
}

export function zeitviewHealthFromPayload(payload, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const state = { level: "ok", summary: "Grabbing Zeitview gigs and filling bookings." };

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { level: "degraded", summary: "Could not read the drone-gigs health check." };
  }

  if (text(payload.status).toLowerCase() !== "ok") {
    raise(state, "down", "The drone-gigs health check is not ok.");
  }
  if (text(payload.lastWatchError)) {
    raise(state, "down", clip(payload.lastWatchError));
  }

  const expires = parseTime(payload.watchExpiration);
  if (expires != null && expires <= nowMs) {
    raise(state, "down", "The Gmail watch has expired.");
  }

  const poll = payload.gmailPoll && typeof payload.gmailPoll === "object" ? payload.gmailPoll : null;
  if (!poll) {
    raise(state, "degraded", "Gmail poll status is missing.");
  } else {
    if (poll.enabled === false) {
      raise(state, "down", "Gmail poll is off, so Zeitview gigs are not being pulled.");
    }
    const result = poll.lastPollResult && typeof poll.lastPollResult === "object" ? poll.lastPollResult : null;
    if (result && result.ok === false) {
      raise(state, "down", clip(result.error) || "The last Gmail poll failed.");
    }
    const polledAt = parseTime(poll.lastPollAt);
    const interval = Number(poll.intervalMs);
    const intervalMs = Number.isFinite(interval) && interval > 0 ? interval : 5 * 60 * 1000;
    if (polledAt == null) {
      raise(state, "degraded", "Gmail poll has not reported a time.");
    } else {
      const age = nowMs - polledAt;
      if (age > Math.max(intervalMs * 3, STALE_FLOOR_MS)) {
        raise(state, "down", "Gmail poll is stale, so new Zeitview gigs may be missed.");
      } else if (age > Math.max(intervalMs * 1.5, LATE_FLOOR_MS)) {
        raise(state, "degraded", "Gmail poll is running late.");
      }
    }
    if (poll.enabled !== false && (!result || result.ok !== true)) {
      raise(state, "degraded", "Gmail poll has not reported a successful pull yet.");
    }
  }

  if (asArray(payload.acceptFailures).length > 0) {
    raise(state, "down", "A Zeitview accept failed and needs attention.");
  }

  const sync = payload.zeitviewProfileSync;
  if (sync && typeof sync === "object") {
    if (sync.lastResult === "failed" || sync.state === "failed" || text(sync.error)) {
      raise(state, "down", clip(sync.error) || "Zeitview profile sync failed.");
    } else if (sync.drift === true) {
      raise(state, "degraded", "Zeitview profile does not match the saved settings.");
    }
  }

  if (asArray(payload.unclearAccepts).length > 0) {
    raise(state, "degraded", "An accept result needs a look.");
  }
  if (asArray(payload.recentMissionOutcomes).some(outcomeFailed)) {
    raise(state, "degraded", "A recent mission outcome needs fixing.");
  }

  const backfill = payload.driveTimeBackfill;
  if (backfill && typeof backfill === "object") {
    if (text(backfill.error) || Number(backfill.failed) > 0) {
      raise(state, "degraded", "Drive times for a Zeitview gig could not be filled.");
    }
  }

  if (expires != null && expires > nowMs && expires - nowMs < WATCH_SOON_MS) {
    raise(state, "degraded", "The Gmail watch expires within a day.");
  }

  return { level: state.level, summary: state.summary };
}

function storedHealth(row, name) {
  if (!row) return null;
  if (row.lastHealth !== "ok" && row.lastHealth !== "degraded" && row.lastHealth !== "down") return null;
  if (row.lastHealth === "ok") {
    return { level: "ok", summary: `Grabbing ${name} gigs and filling bookings.`, from: "stored" };
  }
  const fallback = row.lastHealth === "down"
    ? "This source is broken and needs attention."
    : "Something needs fixing before these gigs can be trusted.";
  return {
    level: row.lastHealth,
    summary: clip(row.lastError) || fallback,
    from: "stored",
  };
}

export function healthForSource(source, row, { live, liveOk, now }) {
  if (source.key === "zeitview" && liveOk) {
    const derived = zeitviewHealthFromPayload(live, now);
    return { ...derived, from: "live" };
  }
  const stored = storedHealth(row, source.name);
  if (stored) return stored;
  if (!liveOk) {
    return { level: "degraded", summary: "Could not reach the drone-gigs health check.", from: "unreachable" };
  }
  return { level: "degraded", summary: "No status for this source yet.", from: "missing" };
}

export function applyEnabled(source, enabled) {
  const dot = enabled ? dotForLevel(source.health?.level) : "gray";
  return {
    ...source,
    enabled: enabled === true,
    dot,
    statusLabel: statusLabelFor(dot),
    statusText: enabled ? source.health.summary : disabledExplanation(source.name),
  };
}

function viewFromParts(source, row, context) {
  const health = healthForSource(source, row, context);
  return applyEnabled(
    {
      key: source.key,
      name: source.name,
      logoSrc: source.logoSrc || null,
      summary: source.summary || "",
      persisted: Boolean(row),
      health,
      lastSuccessAt: row?.lastSuccessAt || null,
      lastError: row?.lastError || null,
      updatedAt: row?.updatedAt || null,
    },
    row ? row.enabled === true : true
  );
}

export function presentSources(rows, { live, liveOk, now } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const byKey = new Map(list.filter((row) => row?.sourceKey).map((row) => [row.sourceKey, row]));
  const context = { live, liveOk: liveOk === true, now: now || new Date() };
  const sources = GIG_SOURCE_CATALOG.map((source) => viewFromParts(source, byKey.get(source.key), context));
  const extras = list
    .filter((row) => row?.sourceKey && !GIG_SOURCE_CATALOG.some((source) => source.key === row.sourceKey))
    .sort((a, b) => String(a.sourceKey).localeCompare(String(b.sourceKey)))
    .map((row) =>
      viewFromParts(
        {
          key: row.sourceKey,
          name: text(row.displayName) || row.sourceKey,
          logoSrc: null,
          summary: "Connected gig source.",
        },
        row,
        context
      )
    );
  return [...sources, ...extras];
}

export function previewSources(state, now = new Date()) {
  const at = new Date(now).toISOString();
  const later = new Date(new Date(now).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    status: "ok",
    lastWatchError: null,
    watchExpiration: later,
    gmailPoll: {
      enabled: true,
      intervalMs: 300000,
      lastPollAt: at,
      lastPollResult: { ok: true, found: 1, queued: 0 },
    },
    acceptFailures: [],
    unclearAccepts: [],
    recentMissionOutcomes: [],
    zeitviewProfileSync: { state: "ok", lastResult: "ok", error: null, drift: false },
    driveTimeBackfill: { error: null, failed: 0 },
  };
  if (state === "orange") payload.zeitviewProfileSync = { ...payload.zeitviewProfileSync, drift: true };
  if (state === "red") payload.acceptFailures = [{ externalMissionId: "DBM1" }];
  return presentSources(
    [{ sourceKey: "zeitview", displayName: "Zeitview", enabled: state !== "disabled" }],
    { live: payload, liveOk: true, now }
  );
}

export async function fetchDroneGigsHealth({
  fetchImpl = fetch,
  healthUrl = DRONE_GIGS_HEALTH_URL,
  timeoutMs = 4000,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(healthUrl, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response?.ok) return { ok: false, payload: null };
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, payload: null };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, payload: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function readDroneGigsHealth(options = {}) {
  const useCache = options.cache !== false && !options.fetchImpl;
  const now = Date.now();
  if (useCache && healthCache.value && now - healthCache.at < HEALTH_CACHE_MS) {
    return healthCache.value;
  }
  const value = await fetchDroneGigsHealth(options);
  if (useCache) healthCache = { at: now, value };
  return value;
}

export async function loadGigSourceView({ rows, tableReady = true, now = new Date(), fetchImpl, healthUrl } = {}) {
  const live = await readDroneGigsHealth({ fetchImpl, healthUrl, cache: !fetchImpl });
  return {
    tableReady: tableReady !== false,
    checkedAt: new Date(now).toISOString(),
    migration: GIG_SOURCES_MIGRATION,
    sources: presentSources(rows || [], { live: live.payload, liveOk: live.ok, now }),
  };
}

export function toggleSavedMessage(name, enabled) {
  return enabled
    ? `${name} is enabled. The bot may pull its gigs and add bookings.`
    : `${name} is disabled. The bot is told not to pull its gigs or add bookings.`;
}

export function previewPageAllowed(env = process.env) {
  if (env.VERCEL_ENV === "preview") return true;
  return env.NODE_ENV !== "production";
}
