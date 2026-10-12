/**
 * One list of jobs for the admin overview and the analytics section.
 *
 * A job is a booking row, plus an accepted mission_listings row whose
 * booking_id is null. Those listings are completed Zeitview jobs:
 * service from mission type, then the client or partner, then the source;
 * date from the scraped flight date (raw_detail schedule), then the mission
 * page (.mission-date/.mission-time, or the date above "You must arrive on
 * time"), then the due window, then the deadline. Last seen is used only
 * when none of those exist. Page times with no zone are US Eastern.
 * location from the address; amount from the payout.
 *
 * A listing with booking_id set is already the booking row. It is not added again.
 * A listing whose cancel_status is cancelled is left out of this list, and so
 * is a booking linked to that listing. Cancel-requested gigs stay in.
 */

import { listingWorkComplete } from "./gigComplete.js";

export function jobAmount(job) {
  if (!job) return 0;
  if (job.payout != null && job.payout !== "") {
    const payout = Number(job.payout);
    if (Number.isFinite(payout)) return payout;
  }
  const price = Number(job.finalPrice ?? job.estimatedPrice ?? 0);
  return Number.isFinite(price) ? price : 0;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function scheduleResult(iso, { hasTime, wallClock, source }) {
  return { date: iso, hasFlightTime: hasTime, wallClock, scheduleSource: source };
}

function emptySchedule(date, source) {
  return { date: date || null, hasFlightTime: false, wallClock: false, scheduleSource: date ? source : null };
}

/**
 * A portal schedule time such as "08/28/2024 3:00 PM" has no timezone.
 * Keep the clock as written (stored as UTC components) so the dashboard
 * shows 3:00 PM instead of shifting it to the viewer's offset.
 */
export function parseScheduleText(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})\s*(AM|PM))?\b/i);
  if (us) {
    const month = Number(us[1]);
    const day = Number(us[2]);
    const year = Number(us[3]);
    let hour = 0;
    let minute = 0;
    const hasTime = us[4] != null;
    if (hasTime) {
      hour = Number(us[4]);
      minute = Number(us[5]);
      const ampm = us[6].toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    return scheduleResult(
      `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`,
      { hasTime, wallClock: true, source: "raw_detail" }
    );
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const hasTime = iso[4] != null;
  const hour = hasTime ? Number(iso[4]) : 0;
  const minute = hasTime ? Number(iso[5]) : 0;
  if (iso[6]) {
    const date = new Date(text.includes(" ") ? text.replace(" ", "T") : text);
    if (Number.isNaN(date.getTime())) return null;
    return scheduleResult(date.toISOString(), { hasTime, wallClock: false, source: "raw_detail" });
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return scheduleResult(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`,
    { hasTime, wallClock: true, source: "raw_detail" }
  );
}

const LABELED_FLIGHT = /flight\s+date\s+and\s+time[\s\S]{0,80}?(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)/i;

function flightFromText(value) {
  if (typeof value !== "string" || !value) return null;
  const labeled = value.match(LABELED_FLIGHT);
  if (!labeled) return null;
  return parseScheduleText(labeled[1]);
}

function keyName(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scheduleFromObject(schedule) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;
  const directKeys = [
    "flightDateAndTime",
    "flight_date_and_time",
    "flightDateTime",
    "flight_date_time",
    "flightDate",
    "flight_date",
    "scheduledAt",
    "scheduled_at",
    "scheduledFor",
    "scheduled_for",
    "dateTime",
    "datetime",
    "when",
    "start",
  ];
  for (const key of directKeys) {
    const parsed = parseScheduleText(schedule[key]);
    if (parsed) return parsed;
  }
  const datePart = schedule.date || schedule.flight_date || schedule.flightDate || schedule.day;
  const timePart = schedule.time || schedule.flight_time || schedule.flightTime;
  if (datePart && timePart) {
    const combined = parseScheduleText(`${datePart} ${timePart}`);
    if (combined) return { ...combined, hasFlightTime: true };
  }
  return parseScheduleText(schedule.date);
}

const FLIGHT_KEY = /^(flightdateandtime|flightdatetime|flightdate|scheduledat|scheduledfor|schedule)$/;

function flightFromDetail(detail, depth = 0) {
  if (detail == null || depth > 8) return null;
  if (typeof detail === "string") {
    const labeled = flightFromText(detail);
    if (labeled) return labeled;
    const trimmed = detail.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return flightFromDetail(JSON.parse(trimmed), depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(detail)) {
    for (const item of detail) {
      const found = flightFromDetail(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof detail !== "object") return null;

  const parsedBlock = detail.parsed && typeof detail.parsed === "object" ? detail.parsed : null;
  const schedule = scheduleFromObject(detail.schedule) || scheduleFromObject(parsedBlock?.schedule);
  if (schedule) return schedule;

  for (const [key, value] of Object.entries(detail)) {
    const name = keyName(key);
    if (name === "parsed" && value && typeof value === "object") {
      const fromParsed = scheduleFromObject(value.schedule) || flightFromDetail(value, depth + 1);
      if (fromParsed) return fromParsed;
    }
    if (!FLIGHT_KEY.test(name)) continue;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = parseScheduleText(value);
      if (parsed) return parsed;
    }
    if (value && typeof value === "object") {
      const fromSchedule = scheduleFromObject(value) || flightFromDetail(value, depth + 1);
      if (fromSchedule) return fromSchedule;
    }
  }

  for (const value of Object.values(detail)) {
    if (typeof value === "string") {
      const labeled = flightFromText(value);
      if (labeled) return labeled;
      const trimmed = value.trim();
      if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length < 500000) {
        try {
          const found = flightFromDetail(JSON.parse(trimmed), depth + 1);
          if (found) return found;
        } catch {
          // Not JSON. The labeled-text scan above is the only string match.
        }
      }
    } else if (value && typeof value === "object") {
      const found = flightFromDetail(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const EASTERN = "America/New_York";

function zonedWallTimeToUtc(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let zonedHour = Number(map.hour);
  if (zonedHour === 24) zonedHour = 0;
  const asZone = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    zonedHour,
    Number(map.minute),
    Number(map.second)
  );
  return new Date(guess.getTime() - (asZone - guess.getTime()));
}

function instantFromWallClock(year, month, day, hour, minute, zone) {
  const name = zone ? String(zone).trim().toUpperCase() : "";
  if (!name || name === "ET") {
    return zonedWallTimeToUtc(year, month, day, hour, minute, EASTERN).toISOString();
  }
  if (name === "EST") {
    return new Date(Date.UTC(year, month - 1, day, hour + 5, minute)).toISOString();
  }
  if (name === "EDT") {
    return new Date(Date.UTC(year, month - 1, day, hour + 4, minute)).toISOString();
  }
  if (name === "Z" || name === "UTC") {
    return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
  }
  const offset = name.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (offset) {
    const sign = offset[1] === "+" ? 1 : -1;
    const minutes = sign * (Number(offset[2]) * 60 + Number(offset[3]));
    return new Date(Date.UTC(year, month - 1, day, hour, minute) - minutes * 60000).toISOString();
  }
  return zonedWallTimeToUtc(year, month, day, hour, minute, EASTERN).toISOString();
}

function pageSchedule(year, month, day, hour, minute, zone, source) {
  return {
    date: instantFromWallClock(year, month, day, hour, minute, zone),
    hasFlightTime: true,
    wallClock: false,
    scheduleSource: source,
  };
}

function parseUsDate(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseMissionClock(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s+([A-Za-z]{2,5}|Z|[+-]\d{2}:?\d{2}))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, zone: match[4] || null };
}

function classText(html, className) {
  const pattern = new RegExp(
    `class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>\\s*([^<]+)`,
    "i"
  );
  const match = html.match(pattern);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function flightFromPageHtml(html) {
  if (typeof html !== "string" || !html.includes("mission-date")) return null;
  const date = parseUsDate(classText(html, "mission-date"));
  const clock = parseMissionClock(classText(html, "mission-time"));
  if (!date || !clock) return null;
  return pageSchedule(date.year, date.month, date.day, clock.hour, clock.minute, clock.zone, "page_html");
}

const ARRIVE_ON_TIME = "you must arrive on time";

function flightFromPageText(text) {
  if (typeof text !== "string" || !text) return null;
  const pair = /(\d{1,2}\/\d{1,2}\/\d{4})(?:\r?\n| )(\d{1,2}:\d{2}(?:AM|PM))(?![A-Za-z])(?:[ \t]+(EST|EDT|ET|UTC|Z|[+-]\d{2}:?\d{2}))?/gi;
  const matches = [];
  for (const match of text.matchAll(pair)) {
    matches.push({
      index: match.index,
      date: match[1],
      time: match[2],
      zone: match[3] || null,
    });
  }
  if (!matches.length) return null;
  const anchor = text.toLowerCase().indexOf(ARRIVE_ON_TIME);
  let chosen = matches[0];
  if (anchor !== -1) {
    const before = matches.filter((item) => item.index < anchor);
    if (before.length) chosen = before[before.length - 1];
  }
  const date = parseUsDate(chosen.date);
  const clock = parseMissionClock(chosen.time);
  if (!date || !clock) return null;
  return pageSchedule(date.year, date.month, date.day, clock.hour, clock.minute, chosen.zone || clock.zone, "page_text");
}

function flightFromStoredPage(detail) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  return flightFromPageHtml(detail.html) || flightFromPageText(detail.text);
}

export function listingSchedule(listing) {
  if (!listing) return emptySchedule(null, null);
  const scraped = flightFromDetail(listing.rawDetail);
  if (scraped?.date) return scraped;
  const page = flightFromStoredPage(listing.rawDetail);
  if (page?.date) return page;
  if (listing.dueWindowStart) {
    return {
      date: listing.dueWindowStart,
      hasFlightTime: clockIsSet(listing.dueWindowStart),
      wallClock: false,
      scheduleSource: "due_window",
    };
  }
  if (listing.deadline) {
    return {
      date: listing.deadline,
      hasFlightTime: clockIsSet(listing.deadline),
      wallClock: false,
      scheduleSource: "deadline",
    };
  }
  if (listing.dueWindowEnd) {
    return {
      date: listing.dueWindowEnd,
      hasFlightTime: clockIsSet(listing.dueWindowEnd),
      wallClock: false,
      scheduleSource: "due_window",
    };
  }
  const seen = listing.lastSeenAt || listing.firstSeenAt || null;
  return emptySchedule(seen, seen ? "last_seen" : null);
}

function clockIsSet(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
}

export function listingEventDate(listing) {
  return listingSchedule(listing).date;
}

function text(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function listingService(listing) {
  return text(listing?.missionType) || text(listing?.clientName) || text(listing?.source) || "zeitview";
}

export function listingToJob(listing) {
  const schedule = listingSchedule(listing);
  const when = schedule.date;
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
    acceptedAt: null,
    date: when,
    hasFlightTime: schedule.hasFlightTime,
    wallClock: schedule.wallClock,
    scheduleSource: schedule.scheduleSource,
    listingId: listing.id,
    listingStatus: listing.status || null,
    workComplete: listingWorkComplete(listing),
    cancelStatus: listing.cancelStatus || null,
    cancelReason: listing.cancelReason || "",
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

export function mergeJobs(bookings, listings, linkedListings = []) {
  const flagByBooking = new Map();
  for (const listing of linkedListings || []) {
    if (listing?.bookingId) flagByBooking.set(listing.bookingId, listing);
  }

  const jobs = [];
  for (const booking of bookings || []) {
    if (!booking) continue;
    const flag = flagByBooking.get(booking.id);
    if (flag?.cancelStatus === "cancelled") continue;
    const job = bookingToJob(booking);
    if (flag) {
      job.listingId = flag.id;
      job.listingStatus = flag.status || null;
      job.cancelStatus = flag.cancelStatus || null;
      job.cancelReason = flag.cancelReason || "";
    }
    job.workComplete = listingWorkComplete(flag) || booking.status === "completed";
    jobs.push(job);
  }

  for (const listing of listings || []) {
    if (!listing || listing.status !== "accepted" || listing.bookingId) continue;
    if (listing.cancelStatus === "cancelled") continue;
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
    recentJobs: [...list].sort(byDateDesc),
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
