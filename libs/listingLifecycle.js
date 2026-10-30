/**
 * Completed and delete rules for a mission listing on the dashboard.
 *
 * The bot's status column only has seen, accepted, declined_by_filter,
 * expired and unavailable. "Completed" is a dashboard view on top of an
 * accepted listing:
 * - listingWorkComplete / gig markers (a "completed" tag, a completed booking,
 *   a flight time long past) already set workComplete;
 * - an accepted listing the bot never accepted (no bot_accepted_at) and that
 *   has no booking is a mission imported from Zeitview's Completed missions
 *   page (drone-gigs backfill-completed.js, Oct 11–12 2026). Once its due
 *   window has ended it is completed.
 *
 * Delete is a soft delete (deleted_at). A listing that is accepted or
 * completed cannot be deleted unless it was cancelled first.
 */

export const COMPLETED_TAG = "completed";
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function hasTime(value) {
  if (value == null || value === "") return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isCancelled(listing) {
  return listing?.cancelStatus === "cancelled";
}

/** End of the stored window: due window end, else start, else deadline. */
export function listingWindowEnd(listing) {
  if (!listing) return null;
  for (const value of [listing.dueWindowEnd, listing.dueWindowStart, listing.deadline]) {
    if (hasTime(value)) return new Date(value);
  }
  return null;
}

/**
 * An imported past mission: accepted, never accepted by the bot, no booking,
 * not cancelled, and its window ended more than 12 hours ago.
 */
export function importedMissionCompleted(listing, now = new Date()) {
  if (!listing || (listing.storedStatus ?? listing.status) !== "accepted") return false;
  if (hasTime(listing.botAcceptedAt) || listing.bookingId || isCancelled(listing)) return false;
  const end = listingWindowEnd(listing);
  if (!end) return false;
  return new Date(now).getTime() - end.getTime() > TWELVE_HOURS_MS;
}

export function hasCompletedTag(listing) {
  return Array.isArray(listing?.tags) && listing.tags.some((tag) => String(tag).trim().toLowerCase() === COMPLETED_TAG);
}

/** Status to show: "completed" for a finished accepted gig, else the stored display status. */
export function lifecycleStatus(listing) {
  if (!listing) return null;
  const stored = listing.storedStatus ?? listing.status;
  if (stored === "accepted" && listing.workComplete && !isCancelled(listing)) return "completed";
  return listing.status;
}

/** Whether "Mark completed" applies: an accepted, not-cancelled gig that is not already complete. */
export function canMarkCompleted(listing) {
  if (!listing || listing.deletedAt) return false;
  const stored = listing.storedStatus ?? listing.status;
  return stored === "accepted" && !isCancelled(listing) && !listing.workComplete;
}

/** Whether "Not completed" applies: only a completion that came from the tag. */
export function canUnmarkCompleted(listing) {
  return Boolean(listing && !listing.deletedAt && hasCompletedTag(listing));
}

export function withCompletedTag(tags, completed) {
  const list = Array.isArray(tags) ? tags.filter((tag) => String(tag).trim().toLowerCase() !== COMPLETED_TAG) : [];
  return completed ? [...list, COMPLETED_TAG] : list;
}

/**
 * Server and UI rule for delete. The listing must carry workComplete and
 * bookingStatus as findListingById returns them.
 */
export function listingDeleteState(listing) {
  if (!listing) return { canDelete: false, reason: "not_found", message: "Listing not found." };
  if (listing.deletedAt) {
    return { canDelete: false, reason: "already_deleted", message: "This listing is already deleted." };
  }
  if (isCancelled(listing)) return { canDelete: true, reason: null, message: "" };
  const stored = listing.storedStatus ?? listing.status;
  if (listing.workComplete || String(listing.bookingStatus || "").toLowerCase() === "completed") {
    return {
      canDelete: false,
      reason: "completed",
      message: "Completed gigs can't be deleted. Only a gig that was cancelled first can be deleted.",
    };
  }
  if (stored === "accepted") {
    return {
      canDelete: false,
      reason: "accepted",
      message: "Accepted gigs can't be deleted. Cancel the gig first, then delete it.",
    };
  }
  if (listing.bookingId && String(listing.bookingStatus || "").toLowerCase() !== "cancelled") {
    return {
      canDelete: false,
      reason: "booked",
      message: "This listing has a booking. Cancel the booking first, then delete it.",
    };
  }
  return { canDelete: true, reason: null, message: "" };
}
