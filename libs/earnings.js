/**
 * Accepted listings with no booking, as the shared job list sees them.
 * Kept so older checks can import the same conversion.
 */

import { filterJobs, jobAmount, listingEventDate, listingToJob } from "./jobs.js";

export { listingEventDate };

export function payoutAmount(value) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function selectUnlinkedEarnings(listings, filters = {}) {
  const jobs = filterJobs(
    (listings || [])
      .filter((listing) => listing && listing.status === "accepted" && !listing.bookingId)
      .map(listingToJob),
    filters
  );

  return jobs.map((job) => ({
    source: job.source,
    status: job.status,
    payout: job.payout,
    travelDistance: job.travelDistance,
    travelTime: job.travelTime,
    acceptedAt: job.date,
    unlinkedListing: true,
  }));
}

export function unlinkedPayoutTotal(listings) {
  return selectUnlinkedEarnings(listings).reduce((sum, mission) => sum + (jobAmount(mission) || 0), 0);
}
