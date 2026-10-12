/**
 * Revenue for accepted Zeitview gigs that were stored on mission_listings
 * without a bookings row.
 *
 * Count every booking, then add accepted listings whose booking_id is null.
 * A listing with booking_id set is already in the booking total.
 *
 * Reading them here is safer than inserting booking rows. bookings.service,
 * bookings.date, and bookings.location are required, and a later bot insert
 * would have to be matched back to a row we invented.
 */

export function listingEventDate(listing) {
  if (!listing) return null;
  return listing.deadline
    || listing.dueWindowEnd
    || listing.dueWindowStart
    || listing.lastSeenAt
    || listing.firstSeenAt
    || null;
}

export function payoutAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Accepted listings with no booking, shaped like the mission records the
 * analytics loop already sums. Status is completed because these rows are
 * finished gigs that were backfilled onto the listing only.
 */
export function selectUnlinkedEarnings(listings, filters = {}) {
  const dateFrom = filters.dateFrom || filters.startDate || null;
  const dateTo = filters.dateTo || filters.endDate || null;
  const status = filters.status || null;
  const source = filters.source || null;
  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs = dateTo ? new Date(dateTo).getTime() : null;

  return (listings || []).flatMap((listing) => {
    if (!listing || listing.bookingId || listing.status !== "accepted") return [];
    if (source && listing.source !== source) return [];
    if (status && status !== "completed" && status !== "accepted") return [];

    const when = listingEventDate(listing);
    const whenMs = when ? new Date(when).getTime() : null;
    if (fromMs != null && (whenMs == null || Number.isNaN(whenMs) || whenMs < fromMs)) return [];
    if (toMs != null && (whenMs == null || Number.isNaN(whenMs) || whenMs > toMs)) return [];

    return [{
      source: listing.source || "zeitview",
      status: "completed",
      payout: payoutAmount(listing.payout),
      travelDistance: payoutAmount(listing.travelDistance),
      travelTime: payoutAmount(listing.travelTime),
      acceptedAt: when,
      unlinkedListing: true,
    }];
  });
}

export function unlinkedPayoutTotal(listings) {
  return selectUnlinkedEarnings(listings).reduce((sum, mission) => sum + (mission.payout || 0), 0);
}
