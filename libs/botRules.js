/**
 * Acceptance rules stored in public.bot_settings (the single row id = 1).
 *
 * The drone-gigs bot reads that row. The same numbers apply to every
 * connected gig source. This file is the dashboard's check of those numbers,
 * plus a preview of how recent listings would be decided.
 * The preview uses the payout and drive time already stored on each listing,
 * unless the form has an unsaved home pin. That preview asks the Routes API
 * for draft drive minutes and does not write them. The bot fills stored
 * travel_time after the address is saved.
 *
 * A drive time is mission_listings.travel_time, in minutes.
 * A long trip is a drive of long_trip_minutes or longer.
 * A drive longer than max_drive_minutes is turned down when that maximum is set.
 * The daily cap counts would-accept decisions per America/New_York calendar day
 * of first_seen_at, earliest first.
 * Minimum notice is applied only when the listing has a real flight time
 * (scraped schedule, mission-page HTML, mission-page text, or a Zeitview
 * confirmation / reschedule sentence). A due window, deadline, or last-seen
 * time is not a flight time, so notice is not guessed.
 */

import { listingSchedule } from "./jobs.js";

export const HOME_ADDRESS = "11205 Keystone Avenue, Clinton, MD";

export const DEFAULT_BOT_SETTINGS = {
  autoAcceptEnabled: true,
  minPayoutUsd: 50,
  longTripMinutes: 60,
  longTripMinPayoutUsd: 100,
  maxDriveMinutes: null,
  homeAddress: HOME_ADDRESS,
  homeLat: 38.737679,
  homeLng: -76.894043,
  dailyAcceptCap: null,
  minNoticeHours: null,
};

export const ZEITVIEW_RADIUS_MILES = [10, 25, 50, 100, 200];

const MONEY_MAX = 100000;
const MINUTES_MAX = 24 * 60;
const NOTICE_MAX = 24 * 7;
const CAP_MAX = 48;
const REAL_FLIGHT_SOURCES = new Set(["raw_detail", "page_html", "page_text", "email"]);

export const DECISION_LABELS = {
  accept: "Would accept",
  decline: "Would turn down",
  skip: "Auto-accept is off",
  unsure: "Can't tell",
};

export const REASON_LABELS = {
  auto_accept_off: "Auto-accept is off, so the bot would not take it.",
  payout_missing: "No payout is stored on the mission.",
  payout_below_minimum: "The payout is under the minimum.",
  drive_time_missing: "No drive time is stored, so the drive rules cannot be checked.",
  drive_too_long: "The drive is longer than the maximum.",
  long_trip_payout: "The drive is a long trip and the payout is under the long-trip minimum.",
  too_little_notice: "The mission was seen too close to the flight time.",
  daily_cap: "The daily accept cap was already filled.",
};

export function normalizeAddress(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function homeAddressChanged(previousAddress, nextAddress) {
  return normalizeAddress(previousAddress) !== normalizeAddress(nextAddress);
}

export function sameHomePin(previous, next) {
  if (!previous) return false;
  const lat = Number(previous.homeLat);
  const lng = Number(previous.homeLng);
  const nextLat = Number(next.homeLat);
  const nextLng = Number(next.homeLng);
  if (![lat, lng, nextLat, nextLng].every(Number.isFinite)) return false;
  return Math.abs(lat - nextLat) < 1e-6 && Math.abs(lng - nextLng) < 1e-6;
}

export const HOME_PIN_REJECTED =
  "Choose an address from the suggestions, or enter the coordinates.";

export const HOME_PIN_SAME =
  "Those coordinates match the saved pin. Enter the coordinates for the new address.";

/**
 * An address change is saved when the admin picked a suggestion, entered
 * coordinates, or the server geocoded the typed address. A typed address
 * with none of those is rejected.
 */
export function classifyHomePin({ addressChanged, pinSource, samePin }) {
  if (pinSource === "manual") {
    if (!addressChanged && samePin) return { action: "keep" };
    if (addressChanged && samePin) return { action: "reject", message: HOME_PIN_SAME };
    return { action: "use-client" };
  }
  if (!addressChanged) return { action: "keep" };
  if (pinSource === "place") return { action: "use-client" };
  return { action: "geocode" };
}

function fail(errors, field, message) {
  errors.push({ field, message });
}

function decimalText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return null;
}

function parseMoney(value, field, label, errors) {
  const text = decimalText(value);
  if (text == null || text === "") {
    fail(errors, field, `Enter ${label}.`);
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    fail(errors, field, `${label} must be a number that is not negative.`);
    return null;
  }
  const decimals = (text.split(".")[1] || "").length;
  if (decimals > 2) {
    fail(errors, field, `${label} can have at most two decimal places.`);
    return null;
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    fail(errors, field, `${label} must be a number that is not negative.`);
    return null;
  }
  if (amount > MONEY_MAX) {
    fail(errors, field, `${label} must be ${MONEY_MAX.toLocaleString("en-US")} or less.`);
    return null;
  }
  return amount;
}

function parseWhole(value, field, label, errors, { min, max, optional }) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    if (optional) return null;
    fail(errors, field, `Enter ${label}.`);
    return null;
  }
  const text = decimalText(value);
  if (text == null || !/^\d+$/.test(text)) {
    fail(errors, field, `${label} must be a whole number from ${min} to ${max}.`);
    return null;
  }
  const amount = Number(text);
  if (!Number.isInteger(amount) || amount < min || amount > max) {
    fail(errors, field, `${label} must be a whole number from ${min} to ${max}.`);
    return null;
  }
  return amount;
}

function parseCoordinate(value, field, label, min, max, errors) {
  const text = decimalText(value);
  if (text == null || text === "") {
    fail(errors, field, `Enter ${label}.`);
    return null;
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    fail(errors, field, `${label} must be a number from ${min} to ${max}.`);
    return null;
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < min || amount > max) {
    fail(errors, field, `${label} must be a number from ${min} to ${max}.`);
    return null;
  }
  return amount;
}

export function snapZeitviewRadius(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "" || text === "current" || text === "keep" || text === "keep current") return null;
    if (!/^\d+(\.\d+)?$/.test(text)) return { error: true };
    value = Number(text);
  }
  const amount = Number(value);
  if (typeof value === "boolean" || !Number.isFinite(amount) || amount < 0) return { error: true };
  let best = ZEITVIEW_RADIUS_MILES[0];
  let bestDistance = Infinity;
  for (const option of ZEITVIEW_RADIUS_MILES) {
    const distance = Math.abs(option - amount);
    if (distance < bestDistance || (distance === bestDistance && option > best)) {
      best = option;
      bestDistance = distance;
    }
  }
  return best;
}

const TRAVEL_RADIUS_MAX = 500;

function finiteMiles(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Columns written for the shared travel radius.
 * The dashboard writes travel_radius_miles. Until that column exists, the
 * save falls back to the compatibility column the live bot still reads,
 * snapped to the radii Zeitview's profile accepts.
 */
export function radiusColumnsForSave(settings, { hasTravelRadiusColumn = true } = {}) {
  if (!settings || !Object.prototype.hasOwnProperty.call(settings, "travelRadiusMiles")) return {};
  const miles = settings.travelRadiusMiles;
  if (hasTravelRadiusColumn) return { travel_radius_miles: miles };
  const snapped = snapZeitviewRadius(miles);
  if (snapped && typeof snapped === "object") return {};
  return { zeitview_radius_miles: snapped };
}

function syncText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function syncRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

export function travelRadiusFromRow(row) {
  if (!row || typeof row !== "object") return { travelRadiusAvailable: false };
  if (Object.prototype.hasOwnProperty.call(row, "travel_radius_miles")) {
    return {
      travelRadiusAvailable: true,
      travelRadiusMiles: finiteMiles(row.travel_radius_miles),
    };
  }
  // Compatibility read, only when the shared column is not in the schema yet.
  if (Object.prototype.hasOwnProperty.call(row, "zeitview_radius_miles")) {
    const snapped = row.zeitview_radius_miles == null ? null : snapZeitviewRadius(row.zeitview_radius_miles);
    return {
      travelRadiusAvailable: true,
      travelRadiusMiles: snapped && typeof snapped === "object" ? null : snapped,
      travelRadiusLegacy: true,
    };
  }
  return { travelRadiusAvailable: false };
}

/**
 * Sync columns the live bot still writes on bot_settings. The dashboard
 * shows the copy on gig_sources. This is only the fallback until that copy
 * is present.
 */
export function legacyZeitviewSyncFromRow(row) {
  if (!row || typeof row !== "object") return null;
  const hasResult = Object.prototype.hasOwnProperty.call(row, "zeitview_last_result");
  const hasTime = Object.prototype.hasOwnProperty.call(row, "zeitview_last_synced_at");
  if (!hasResult && !hasTime) return null;
  const result = row.zeitview_last_result === "ok" || row.zeitview_last_result === "failed"
    ? row.zeitview_last_result
    : null;
  return {
    result,
    syncedAt: row.zeitview_last_synced_at || null,
    error: typeof row.zeitview_last_error === "string" ? row.zeitview_last_error : "",
    observed: syncRecord(row.zeitview_observed),
    requestedAt: null,
  };
}

export function syncObservedPlace(observed) {
  const row = syncRecord(observed);
  if (!row) return "";
  const address = syncRecord(row.address) || syncRecord(row.address_parts) || {};
  const street = syncText(
    address.street,
    address.street_address,
    address.address_line_1,
    address.line1,
    address.address1,
    row.street,
    row.street_address,
    row.address_line_1,
    row.line1,
    row.address1
  );
  const city = syncText(address.city, address.locality, address.town, row.city, row.locality, row.town);
  if (street && city) return `${street}, ${city}`;
  if (typeof row.address === "string") return row.address.trim();
  return street || city;
}

export function syncObservedMiles(observed) {
  const row = syncRecord(observed);
  if (!row) return null;
  const nested = syncRecord(row.address);
  const raw = row.travel_distance ?? row.travelDistance ?? row.travel_radius_miles ?? nested?.travel_distance;
  if (raw == null || raw === "") return null;
  const amount = typeof raw === "string" ? Number((raw.trim().match(/^(\d+(?:\.\d+)?)/) || [])[1]) : Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function describeProfileSync(name, sync, formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}) {
  if (!sync || !name) return null;
  if (sync.result === "failed") {
    return {
      state: "failed",
      title: `${name} sync broke, script needs updating`,
      detail: typeof sync.error === "string" ? sync.error.trim() : "",
    };
  }
  if (sync.result === "nothing") {
    return { state: "nothing", text: "Nothing to sync." };
  }
  if (sync.result === "ok" && sync.syncedAt) {
    const when = formatTime(sync.syncedAt);
    if (!when) return null;
    const place = syncObservedPlace(sync.observed);
    const miles = syncObservedMiles(sync.observed);
    if (place && miles != null) {
      return { state: "ok", text: `Synced ${when}: ${miles} mi from ${place}` };
    }
    return { state: "ok", text: `Synced ${when}.` };
  }
  if (sync.requestedAt && !sync.syncedAt) {
    return { state: "pending", text: "Sync requested. Waiting for the drone-gigs bot." };
  }
  return null;
}

export function validateBotSettings(input) {
  const errors = [];
  const source = input && typeof input === "object" ? input : {};

  if (typeof source.autoAcceptEnabled !== "boolean") {
    fail(errors, "autoAcceptEnabled", "Choose whether the bot accepts gigs automatically.");
  }

  const minPayoutUsd = parseMoney(source.minPayoutUsd, "minPayoutUsd", "the minimum payout", errors);
  const longTripMinutes = parseWhole(
    source.longTripMinutes,
    "longTripMinutes",
    "the long-trip length",
    errors,
    { min: 1, max: MINUTES_MAX }
  );
  const longTripMinPayoutUsd = parseMoney(
    source.longTripMinPayoutUsd,
    "longTripMinPayoutUsd",
    "the long-trip minimum payout",
    errors
  );
  const maxDriveMinutes = parseWhole(
    source.maxDriveMinutes,
    "maxDriveMinutes",
    "the maximum drive",
    errors,
    { min: 1, max: MINUTES_MAX, optional: true }
  );
  const dailyAcceptCap = parseWhole(
    source.dailyAcceptCap,
    "dailyAcceptCap",
    "the daily accept cap",
    errors,
    { min: 1, max: CAP_MAX, optional: true }
  );
  const minNoticeHours = parseWhole(
    source.minNoticeHours,
    "minNoticeHours",
    "the minimum notice",
    errors,
    { min: 0, max: NOTICE_MAX, optional: true }
  );

  const homeAddress = normalizeAddress(source.homeAddress);
  if (homeAddress.length < 8 || homeAddress.length > 300) {
    fail(errors, "homeAddress", "Enter the home address (8 to 300 characters).");
  }

  const homeLat = parseCoordinate(source.homeLat, "homeLat", "the latitude", -90, 90, errors);
  const homeLng = parseCoordinate(source.homeLng, "homeLng", "the longitude", -180, 180, errors);
  const hasTravelRadius = Object.prototype.hasOwnProperty.call(source, "travelRadiusMiles");
  let travelRadiusMiles = null;
  if (hasTravelRadius) {
    travelRadiusMiles = parseWhole(
      source.travelRadiusMiles,
      "travelRadiusMiles",
      "the travel radius",
      errors,
      { min: 1, max: TRAVEL_RADIUS_MAX, optional: true }
    );
  }

  if (
    minPayoutUsd != null &&
    longTripMinPayoutUsd != null &&
    longTripMinPayoutUsd < minPayoutUsd
  ) {
    fail(
      errors,
      "longTripMinPayoutUsd",
      "The long-trip minimum has to be at least the regular minimum payout."
    );
  }

  if (errors.length) {
    return { ok: false, errors, settings: null };
  }

  return {
    ok: true,
    errors: [],
    settings: {
      autoAcceptEnabled: source.autoAcceptEnabled,
      minPayoutUsd,
      longTripMinutes,
      longTripMinPayoutUsd,
      maxDriveMinutes,
      homeAddress,
      homeLat,
      homeLng,
      dailyAcceptCap,
      minNoticeHours,
      ...(hasTravelRadius ? { travelRadiusMiles } : {}),
    },
  };
}

function listingValue(listing, camel, snake) {
  if (!listing) return null;
  if (listing[camel] != null && listing[camel] !== "") return listing[camel];
  if (listing[snake] != null && listing[snake] !== "") return listing[snake];
  return null;
}

function listingNumber(listing, camel, snake) {
  const value = listingValue(listing, camel, snake);
  if (value == null) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function noticeHours(listing) {
  const schedule = listingSchedule({
    rawDetail: listing.rawDetail || listing.raw_detail || null,
    rawEmailText: listing.rawEmailText || listing.raw_email_text || null,
    dueWindowStart: listing.dueWindowStart || listing.due_window_start || null,
    dueWindowEnd: listing.dueWindowEnd || listing.due_window_end || null,
    deadline: listing.deadline || null,
    lastSeenAt: listing.lastSeenAt || listing.last_seen_at || null,
    firstSeenAt: listing.firstSeenAt || listing.first_seen_at || null,
  });
  if (!REAL_FLIGHT_SOURCES.has(schedule.scheduleSource) || !schedule.date) return null;
  const seen = new Date(listing.firstSeenAt || listing.first_seen_at).getTime();
  const flight = new Date(schedule.date).getTime();
  if (!Number.isFinite(seen) || !Number.isFinite(flight)) return null;
  return (flight - seen) / (60 * 60 * 1000);
}

export function decideListing(listing, settings) {
  const rules = settings || DEFAULT_BOT_SETTINGS;
  if (!rules.autoAcceptEnabled) {
    return { decision: "skip", reason: "auto_accept_off" };
  }

  const payout = listingNumber(listing, "payout", "payout");
  if (payout == null) {
    return { decision: "decline", reason: "payout_missing" };
  }
  if (payout < Number(rules.minPayoutUsd)) {
    return { decision: "decline", reason: "payout_below_minimum" };
  }

  const drive = listingNumber(listing, "travelTime", "travel_time");
  if (drive == null) {
    return { decision: "unsure", reason: "drive_time_missing" };
  }
  if (rules.maxDriveMinutes != null && drive > Number(rules.maxDriveMinutes)) {
    return { decision: "decline", reason: "drive_too_long" };
  }
  if (drive >= Number(rules.longTripMinutes) && payout < Number(rules.longTripMinPayoutUsd)) {
    return { decision: "decline", reason: "long_trip_payout" };
  }

  if (rules.minNoticeHours != null) {
    const hours = noticeHours(listing);
    if (hours != null && hours < Number(rules.minNoticeHours)) {
      return { decision: "decline", reason: "too_little_notice" };
    }
  }

  return { decision: "accept", reason: null };
}

function dollars(value) {
  const amount = Number(value);
  const rounded = Math.round(amount * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

function compactCount(value) {
  const amount = Number(value);
  if (Number.isInteger(amount)) return String(amount);
  return String(Math.round(amount * 10) / 10);
}

function driveLength(minutes) {
  const amount = Number(minutes);
  if (amount === 60) return "an hour";
  if (amount === 1) return "1 minute";
  return `${compactCount(amount)} minutes`;
}

function hourLength(hours) {
  const count = compactCount(Number(hours));
  return `${count} ${count === "1" ? "hour" : "hours"}`;
}

/**
 * Every rule this listing fails, for the preview column only.
 * decideListing still stops at the first failure. That short-circuit is
 * what the counts use, and it is what the bot does.
 */
export function explainListing(listing, settings) {
  const rules = settings || DEFAULT_BOT_SETTINGS;
  const failures = [];
  if (!rules.autoAcceptEnabled) {
    failures.push({
      code: "auto_accept_off",
      tone: "skip",
      text: "Auto-accept is off, so the bot would not take it.",
    });
  }

  const payout = listingNumber(listing, "payout", "payout");
  if (payout == null) {
    failures.push({
      code: "payout_missing",
      tone: "decline",
      text: "No payout is stored on the mission.",
    });
  } else if (payout < Number(rules.minPayoutUsd)) {
    failures.push({
      code: "payout_below_minimum",
      tone: "decline",
      text: `Pays ${dollars(payout)}, below your ${dollars(rules.minPayoutUsd)} minimum`,
    });
  }

  const drive = listingNumber(listing, "travelTime", "travel_time");
  if (drive == null) {
    failures.push({
      code: "drive_time_missing",
      tone: "unsure",
      text: "No drive time is stored, so the drive rules cannot be checked.",
    });
  } else {
    if (rules.maxDriveMinutes != null && drive > Number(rules.maxDriveMinutes)) {
      failures.push({
        code: "drive_too_long",
        tone: "decline",
        text: `This drive is ${driveLength(drive)}, past your maximum of ${driveLength(rules.maxDriveMinutes)}.`,
      });
    }
    if (
      payout != null &&
      drive >= Number(rules.longTripMinutes) &&
      payout < Number(rules.longTripMinPayoutUsd)
    ) {
      failures.push({
        code: "long_trip_payout",
        tone: "decline",
        text: `Pays ${dollars(payout)}, but drives of ${driveLength(rules.longTripMinutes)} or more need at least ${dollars(rules.longTripMinPayoutUsd)} (this one is ${compactCount(drive)} min)`,
      });
    }
  }

  if (rules.minNoticeHours != null) {
    const hours = noticeHours(listing);
    if (hours != null && hours < Number(rules.minNoticeHours)) {
      failures.push({
        code: "too_little_notice",
        tone: "decline",
        text: `The flight is ${hourLength(hours)} away, short of your ${hourLength(rules.minNoticeHours)} notice.`,
      });
    }
  }

  return failures;
}

function easternDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function previewDecisions(listings, settings, now = new Date()) {
  const rules = settings || DEFAULT_BOT_SETTINGS;
  const nowMs = new Date(now).getTime();
  const startMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const rows = (Array.isArray(listings) ? listings : [])
    .filter((listing) => {
      const seen = new Date(listing?.firstSeenAt || listing?.first_seen_at).getTime();
      return Number.isFinite(seen) && seen >= startMs && seen <= nowMs;
    })
    .sort((a, b) => {
      return new Date(a.firstSeenAt || a.first_seen_at) - new Date(b.firstSeenAt || b.first_seen_at);
    });

  const acceptedByDay = new Map();
  const reasons = {};
  const samples = [];
  const totals = { wouldAccept: 0, wouldDecline: 0, skipped: 0, unsure: 0 };

  for (const listing of rows) {
    let { decision, reason } = decideListing(listing, rules);
    const failures = explainListing(listing, rules);
    if (rules.dailyAcceptCap != null) {
      const day = easternDay(listing.firstSeenAt || listing.first_seen_at) || "unknown";
      const used = acceptedByDay.get(day) || 0;
      if (used >= Number(rules.dailyAcceptCap)) {
        failures.push({
          code: "daily_cap",
          tone: "decline",
          text: `Today's cap of ${compactCount(rules.dailyAcceptCap)} accepted ${Number(rules.dailyAcceptCap) === 1 ? "mission is" : "missions are"} already filled.`,
        });
        if (decision === "accept") {
          decision = "decline";
          reason = "daily_cap";
        }
      } else if (decision === "accept") {
        acceptedByDay.set(day, used + 1);
      }
    }

    if (decision === "accept") totals.wouldAccept += 1;
    else if (decision === "decline") totals.wouldDecline += 1;
    else if (decision === "skip") totals.skipped += 1;
    else totals.unsure += 1;

    if (reason) reasons[reason] = (reasons[reason] || 0) + 1;

    samples.push({
      id: listing.id || null,
      externalMissionId: listing.externalMissionId || listing.external_mission_id || null,
      title: listing.title || null,
      address: listing.address || null,
      payout: listingNumber(listing, "payout", "payout"),
      travelTime: listingNumber(listing, "travelTime", "travel_time"),
      firstSeenAt: listing.firstSeenAt || listing.first_seen_at || null,
      decision,
      reason,
      failures,
    });
  }

  return {
    windowDays: 30,
    considered: rows.length,
    ...totals,
    reasons,
    samples: samples.slice(-12).reverse(),
  };
}
