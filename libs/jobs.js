/**
 * One list of jobs for the admin overview and the analytics section.
 *
 * A job is a booking row, plus an accepted mission_listings row whose
 * booking_id is null. Those listings are completed Zeitview jobs:
 * service from mission type, then the client or partner, then the source;
 * date from the deadline, then the due window, then last seen;
 * location from the address; amount from the payout.
 *
 * A listing with booking_id set is already the booking row. It is not added again.
 */

export function jobAmount(job) {
  if (!job) return 0;
  if (job.payout != null && job.payout !== "") {
    const payout = Number(job.payout);
    if (Number.isFinite(payout)) return payout;
  }
  const price = Number(job.finalPrice ?? job.estimatedPrice ?? 0);
  return Number.isFinite(price) ? price : 0;
}

export function listingEventDate(listing) {
  if (!listing) return null;
  return listing.deadline
    || listing.dueWindowEnd
    || listing.dueWindowStart
    || listing.lastSeenAt
    || listing.firstSeenAt
    || null;
}

function text(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function listingService(listing) {
  return text(listing?.missionType) || text(listing?.clientName) || text(listing?.source) || "zeitview";
}

export function listingToJob(listing) {
  const when = listingEventDate(listing);
  const payout = listing?.payout == null || listing.payout === "" ? null : Number(listing.payout);
  const amount = Number.isFinite(payout) ? payout : 0;
  const seen = listing?.firstSeenAt || listing?.lastSeenAt || when;

  return {
    id: listing.id,
    _id: listing.id,
    source: listing.source || "zeitview",
    service: listingService(listing),
    package: null,
    missionId: listing.externalMissionId || null,
    payout: Number.isFinite(payout) ? payout : null,
    travelDistance: numberOrNull(listing.travelDistance),
    travelTime: numberOrNull(listing.travelTime),
    duration: numberOrNull(listing.estimatedOnSiteMinutes),
    acceptedAt: when,
    date: when,
    location: text(listing.address) || "Address not listed",
    details: text(listing.title),
    name: text(listing.title) || text(listing.clientName) || "Zeitview mission",
    email: "",
    phone: "",
    estimatedPrice: null,
    finalPrice: null,
    status: "completed",
    adminNotes: listing.adminNotes || "",
    createdAt: seen,
    updatedAt: listing.updatedAt || seen,
    isMission: true,
    unlinkedListing: true,
    readOnly: true,
    amount,
    displayPrice: amount,
  };
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bookingToJob(booking) {
  return {
    ...booking,
    location: text(booking.location) || "Address not listed",
    name: text(booking.name) || "Booking",
    email: booking.email || "",
    unlinkedListing: false,
    readOnly: false,
    amount: jobAmount(booking),
    isMission: Boolean(booking.source && booking.source !== "customer"),
  };
}

export function mergeJobs(bookings, listings) {
  const jobs = (bookings || []).filter(Boolean).map(bookingToJob);
  for (const listing of listings || []) {
    if (!listing || listing.status !== "accepted" || listing.bookingId) continue;
    jobs.push(listingToJob(listing));
  }
  return jobs;
}

function inRange(value, fromMs, toMs) {
  if (fromMs == null && toMs == null) return true;
  if (!value) return false;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return false;
  if (fromMs != null && ms < fromMs) return false;
  if (toMs != null && ms > toMs) return false;
  return true;
}

export function filterJobs(jobs, filters = {}) {
  const fromMs = filters.dateFrom || filters.startDate ? new Date(filters.dateFrom || filters.startDate).getTime() : null;
  const toMs = filters.dateTo || filters.endDate ? new Date(filters.dateTo || filters.endDate).getTime() : null;
  const status = filters.status || null;
  const source = filters.source || null;
  const service = filters.service ? String(filters.service).toLowerCase() : null;

  return (jobs || []).filter((job) => {
    if (filters.missionsOnly && !job.isMission) return false;
    if (source && job.source !== source) return false;
    if (status && job.status !== status) return false;
    if (service && String(job.service || "").toLowerCase() !== service) return false;
    if (!inRange(job.date, fromMs, toMs)) return false;
    if (filters.payoutMin !== undefined && filters.payoutMin !== null && filters.payoutMin !== "") {
      if ((job.payout ?? job.amount) < Number(filters.payoutMin)) return false;
    }
    if (filters.payoutMax !== undefined && filters.payoutMax !== null && filters.payoutMax !== "") {
      if ((job.payout ?? job.amount) > Number(filters.payoutMax)) return false;
    }
    if (filters.travelDistanceMax !== undefined && filters.travelDistanceMax !== null && filters.travelDistanceMax !== "") {
      if (job.travelDistance == null || job.travelDistance > Number(filters.travelDistanceMax)) return false;
    }
    return true;
  });
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function byDateDesc(left, right) {
  const leftMs = left.date ? new Date(left.date).getTime() : 0;
  const rightMs = right.date ? new Date(right.date).getTime() : 0;
  return rightMs - leftMs;
}

export function summarizeJobs(jobs, { now = new Date() } = {}) {
  const list = jobs || [];
  const stats = {};
  const sourceStats = {};
  const serviceStats = {};
  const months = new Map();
  let revenue = 0;
  let priced = 0;

  for (const job of list) {
    const amount = jobAmount(job);
    revenue += amount;
    if (amount > 0) priced += 1;
    const status = job.status || "unknown";
    if (!stats[status]) stats[status] = { count: 0, totalValue: 0 };
    stats[status].count += 1;
    stats[status].totalValue += amount;

    const sourceKey = job.source || "customer";
    if (!sourceStats[sourceKey]) sourceStats[sourceKey] = { count: 0, totalValue: 0 };
    sourceStats[sourceKey].count += 1;
    sourceStats[sourceKey].totalValue += amount;

    const serviceKey = job.service || "Unknown";
    if (!serviceStats[serviceKey]) serviceStats[serviceKey] = { service: serviceKey, count: 0, totalValue: 0 };
    serviceStats[serviceKey].count += 1;
    serviceStats[serviceKey].totalValue += amount;

    if (job.date) {
      const date = new Date(job.date);
      if (!Number.isNaN(date.getTime())) {
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
        if (!months.has(key)) {
          months.set(key, {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            count: 0,
            totalValue: 0,
          });
        }
        const month = months.get(key);
        month.count += 1;
        month.totalValue += amount;
      }
    }
  }

  const missions = list.filter((job) => job.isMission);
  const payouts = missions.map((job) => job.payout).filter((value) => value != null);
  const distances = missions.map((job) => job.travelDistance).filter((value) => value != null);
  const times = missions.map((job) => job.travelTime).filter((value) => value != null);
  const completed = stats.completed?.count || 0;
  const upcomingJobs = list
    .filter((job) => job.status !== "completed" && job.status !== "cancelled" && job.date && new Date(job.date) >= now)
    .sort((left, right) => new Date(left.date) - new Date(right.date));

  return {
    totalJobs: list.length,
    totalRevenue: revenue,
    averageJobValue: priced ? revenue / priced : 0,
    pricedJobs: priced,
    conversionRate: list.length ? (completed / list.length) * 100 : 0,
    customerBookings: list.filter((job) => !job.isMission).length,
    stats,
    sourceStats,
    missionStats: {
      totalMissions: missions.length,
      totalPayout: payouts.reduce((sum, value) => sum + value, 0),
      avgPayout: average(payouts),
      avgTravelDistance: average(distances),
      avgTravelTime: average(times),
    },
    topServices: Object.values(serviceStats)
      .sort((left, right) => right.totalValue - left.totalValue || right.count - left.count)
      .slice(0, 5),
    revenueByMonth: [...months.values()].sort((left, right) => left.year - right.year || left.month - right.month),
    upcomingCount: upcomingJobs.length,
    upcomingJobs: upcomingJobs.slice(0, 5),
    recentJobs: [...list].sort(byDateDesc).slice(0, 5),
    statusCounts: Object.fromEntries(Object.entries(stats).map(([status, row]) => [status, row.count])),
  };
}

const DISTANCE_BUCKETS = [0, 10, 25, 50, "100+"];

function distanceBucket(miles) {
  if (miles < 10) return 0;
  if (miles < 25) return 10;
  if (miles < 50) return 25;
  if (miles < 100) return 50;
  return "100+";
}

export function summarizeAnalytics(jobs) {
  const summary = summarizeJobs(jobs);
  const list = jobs || [];
  const efficiency = {
    totalMissions: list.length,
    completedMissions: summary.stats.completed?.count || 0,
    cancelledMissions: summary.stats.cancelled?.count || 0,
    inProgressMissions: summary.stats["in-progress"]?.count || 0,
    confirmedMissions: summary.stats.confirmed?.count || 0,
    pendingMissions: summary.stats.pending?.count || 0,
    totalRevenue: summary.totalRevenue,
    totalTravelDistance: 0,
    totalTravelTime: 0,
    minPayout: null,
    maxPayout: null,
    minTravelDistance: null,
    maxTravelDistance: null,
  };
  const buckets = new Map(DISTANCE_BUCKETS.map((id) => [id, { _id: id, count: 0, totalPayout: 0 }]));
  const days = new Map();
  const sourceBreakdown = {};
  let payoutSum = 0;
  let payoutCount = 0;
  let distanceSum = 0;
  let distanceCount = 0;
  let timeSum = 0;
  let timeCount = 0;

  for (const job of list) {
    const amount = jobAmount(job);
    if (job.payout != null) {
      payoutSum += job.payout;
      payoutCount += 1;
      efficiency.minPayout = efficiency.minPayout == null ? job.payout : Math.min(efficiency.minPayout, job.payout);
      efficiency.maxPayout = efficiency.maxPayout == null ? job.payout : Math.max(efficiency.maxPayout, job.payout);
    } else if (amount > 0) {
      efficiency.minPayout = efficiency.minPayout == null ? amount : Math.min(efficiency.minPayout, amount);
      efficiency.maxPayout = efficiency.maxPayout == null ? amount : Math.max(efficiency.maxPayout, amount);
    }
    if (job.travelDistance != null) {
      distanceSum += job.travelDistance;
      distanceCount += 1;
      efficiency.totalTravelDistance += job.travelDistance;
      efficiency.minTravelDistance = efficiency.minTravelDistance == null
        ? job.travelDistance
        : Math.min(efficiency.minTravelDistance, job.travelDistance);
      efficiency.maxTravelDistance = efficiency.maxTravelDistance == null
        ? job.travelDistance
        : Math.max(efficiency.maxTravelDistance, job.travelDistance);
      const bucket = buckets.get(distanceBucket(job.travelDistance));
      bucket.count += 1;
      bucket.totalPayout += amount;
    }
    if (job.travelTime != null) {
      timeSum += job.travelTime;
      timeCount += 1;
      efficiency.totalTravelTime += job.travelTime;
    }

    const sourceKey = job.source || "customer";
    if (!sourceBreakdown[sourceKey]) {
      sourceBreakdown[sourceKey] = {
        count: 0,
        totalPayout: 0,
        payoutCount: 0,
        distanceSum: 0,
        distanceCount: 0,
        timeSum: 0,
        timeCount: 0,
        statusCounts: {},
      };
    }
    const sourceRow = sourceBreakdown[sourceKey];
    sourceRow.count += 1;
    sourceRow.totalPayout += amount;
    sourceRow.payoutCount += 1;
    sourceRow.statusCounts[job.status] = (sourceRow.statusCounts[job.status] || 0) + 1;
    if (job.travelDistance != null) {
      sourceRow.distanceSum += job.travelDistance;
      sourceRow.distanceCount += 1;
    }
    if (job.travelTime != null) {
      sourceRow.timeSum += job.travelTime;
      sourceRow.timeCount += 1;
    }

    if (job.date) {
      const date = new Date(job.date);
      if (!Number.isNaN(date.getTime())) {
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
        if (!days.has(key)) {
          days.set(key, {
            _id: { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
            count: 0,
            totalPayout: 0,
            payoutCount: 0,
          });
        }
        const day = days.get(key);
        day.count += 1;
        day.totalPayout += amount;
        day.payoutCount += 1;
      }
    }
  }

  for (const sourceRow of Object.values(sourceBreakdown)) {
    sourceRow.avgPayout = sourceRow.payoutCount ? sourceRow.totalPayout / sourceRow.payoutCount : 0;
    sourceRow.avgTravelDistance = sourceRow.distanceCount ? sourceRow.distanceSum / sourceRow.distanceCount : 0;
    sourceRow.avgTravelTime = sourceRow.timeCount ? sourceRow.timeSum / sourceRow.timeCount : 0;
  }

  const revenuePerMile = efficiency.totalTravelDistance > 0
    ? efficiency.totalRevenue / efficiency.totalTravelDistance
    : 0;

  return {
    summary: {
      totalMissions: list.length,
      totalJobs: list.length,
      totalPayout: payoutSum,
      totalRevenue: summary.totalRevenue,
      avgPayout: payoutCount ? payoutSum / payoutCount : summary.averageJobValue,
      averageJobValue: summary.averageJobValue,
      avgTravelDistance: distanceCount ? distanceSum / distanceCount : 0,
      avgTravelTime: timeCount ? timeSum / timeCount : 0,
      statusCounts: summary.statusCounts,
      completionRate: Number(summary.conversionRate.toFixed(2)),
      conversionRate: Number(summary.conversionRate.toFixed(2)),
      revenuePerMile: Number(revenuePerMile.toFixed(2)),
      upcomingJobs: summary.upcomingCount,
    },
    sourceBreakdown,
    timeBasedAnalytics: [...days.values()]
      .map((day) => ({
        _id: day._id,
        count: day.count,
        totalPayout: day.totalPayout,
        avgPayout: day.payoutCount ? day.totalPayout / day.payoutCount : 0,
      }))
      .sort((left, right) => left._id.year - right._id.year || left._id.month - right._id.month || left._id.day - right._id.day),
    revenueByMonth: summary.revenueByMonth,
    topServices: summary.topServices,
    upcomingJobs: summary.upcomingJobs,
    performanceMetrics: efficiency,
    locationInsights: [...buckets.values()]
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        ...bucket,
        avgPayout: bucket.count ? bucket.totalPayout / bucket.count : 0,
      })),
  };
}
