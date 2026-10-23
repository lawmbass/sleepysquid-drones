/**
 * The drone bot stores a listing it could not locate as status "seen" with
 * decline_reason "needs_review: location_not_found". Show that as its own
 * status so it is not mistaken for an ordinary seen listing.
 */
export const NEEDS_REVIEW = "needs_review";

export function isNeedsReviewReason(reason) {
  return /^needs_review\b/.test(String(reason || ""));
}

export function displayStatus(status, declineReason) {
  if (status === "seen" && isNeedsReviewReason(declineReason)) return NEEDS_REVIEW;
  return status;
}
