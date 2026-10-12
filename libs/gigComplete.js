/**
 * Whether a Zeitview gig is finished, so Cancel gig stays hidden.
 *
 * The bot's listing status check is still seen, accepted, declined_by_filter,
 * expired, or unavailable. The completed-mission backfill wrote status
 * "accepted" and no booking row, so that status alone is not a completion
 * mark. Completion is a linked booking status of completed, or a status-like
 * field (listing status, raw_detail status / mission_status / backfill, or a
 * tag) whose value is completed, flown, uploaded, or completed-mission.
 * Page HTML and email text are ignored so instructions do not count.
 */

const COMPLETION_VALUES = new Set([
  "completed",
  "complete",
  "flown",
  "uploaded",
  "assetsuploaded",
  "assetuploaded",
  "completedmission",
  "missioncompleted",
  "missionflown",
  "uploadcomplete",
]);

const STATUS_KEYS = new Set([
  "status",
  "missionstatus",
  "pilotstatus",
  "workflowstatus",
  "uploadstatus",
  "completionstatus",
  "backfill",
  "backfillstatus",
  "state",
  "gigstatus",
  "listingstatus",
]);

const SKIP_KEYS = new Set([
  "html",
  "text",
  "rawemailhtml",
  "rawemailtext",
  "body",
  "instructions",
  "description",
  "details",
  "flightplan",
  "requiredequipment",
  "requiredcertifications",
  "deliverables",
  "email",
  "title",
  "address",
  "name",
]);

function token(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCompletionValue(value) {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const normalized = token(value);
  return normalized.length > 0 && COMPLETION_VALUES.has(normalized);
}

function keyName(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detailHasCompletion(detail, depth) {
  if (detail == null || depth > 6) return false;
  if (typeof detail === "string") {
    const trimmed = detail.trim();
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length < 500000) {
      try {
        return detailHasCompletion(JSON.parse(trimmed), depth + 1);
      } catch {
        return false;
      }
    }
    return false;
  }
  if (Array.isArray(detail)) {
    return detail.some((item) => detailHasCompletion(item, depth + 1));
  }
  if (typeof detail !== "object") return false;
  for (const [key, value] of Object.entries(detail)) {
    const name = keyName(key);
    if (SKIP_KEYS.has(name)) continue;
    if (STATUS_KEYS.has(name) && isCompletionValue(value)) return true;
    if (value && typeof value === "object" && detailHasCompletion(value, depth + 1)) return true;
  }
  return false;
}

export function listingWorkComplete(listing) {
  if (!listing) return false;
  if (isCompletionValue(listing.status)) return true;
  if (Array.isArray(listing.tags) && listing.tags.some((tag) => isCompletionValue(tag))) return true;
  return detailHasCompletion(listing.rawDetail ?? listing.raw_detail, 0);
}

export function bookingWorkComplete(bookingStatus, { unlinkedListing = false } = {}) {
  if (unlinkedListing) return false;
  return token(bookingStatus || "") === "completed";
}

export function cancelGigVisibility({
  listing,
  bookingStatus,
  unlinkedListing = false,
  workComplete,
} = {}) {
  const finished = workComplete === true
    || listingWorkComplete(listing)
    || bookingWorkComplete(bookingStatus ?? listing?.bookingStatus, { unlinkedListing });
  const cancelled = listing?.cancelStatus === "cancelled";
  const accepted = (listing?.status || "accepted") === "accepted";
  return {
    workComplete: finished,
    showCancel: accepted && !finished && !cancelled,
    showUndo: Boolean(listing?.cancelStatus) && !finished,
  };
}
