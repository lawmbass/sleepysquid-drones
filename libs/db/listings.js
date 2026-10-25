import { assertNoError, db, escapeIlike, fetchAll, isUuid, num, parseSort } from "@/libs/db/shared";
import { bookingWorkComplete, listingWorkComplete } from "@/libs/gigComplete";
import { scheduledFlightLongPast } from "@/libs/jobs";
import { knownZeitviewFlight } from "@/libs/zeitviewFlights";
import { NEEDS_REVIEW, displayStatus } from "@/libs/listingStatus";
import { resolveListingMissionType } from "@/libs/missionType";
import { messagePreview, receivedAt } from "@/libs/listingSources";

export function mapListing(row) {
  if (!row) return null;
  const listing = {
    id: row.id,
    _id: row.id,
    source: row.source,
    externalMissionId: row.external_mission_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    status: displayStatus(row.status, row.decline_reason),
    storedStatus: row.status,
    declineReason: row.decline_reason,
    title: row.title,
    clientName: row.client_name,
    missionType: row.mission_type,
    address: row.address,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    payout: num(row.payout),
    travelDistance: num(row.travel_distance),
    travelTime: num(row.travel_time),
    dueWindowStart: row.due_window_start,
    dueWindowEnd: row.due_window_end,
    deadline: row.deadline,
    estimatedOnSiteMinutes: num(row.estimated_on_site_minutes),
    requiredEquipment: row.required_equipment || [],
    requiredCertifications: row.required_certifications || [],
    deliverables: row.deliverables || [],
    flightPlan: row.flight_plan || [],
    rawEmailHtml: row.raw_email_html,
    rawEmailText: row.raw_email_text,
    rawDetail: row.raw_detail,
    bookingId: row.booking_id,
    botAcceptedAt: row.bot_accepted_at || null,
    adminNotes: row.admin_notes || "",
    tags: row.tags || [],
    cancelStatus: row.cancel_status || null,
    cancelReason: row.cancel_reason || "",
    cancelRequestedAt: row.cancel_requested_at || null,
    cancelledAt: row.cancelled_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  // mission_type is rarely stored by the bot; fall back to a type derived from the text.
  const resolved = resolveListingMissionType({ ...listing, raw_detail: row.raw_detail });
  listing.missionType = resolved.type;
  listing.missionTypeSource = resolved.source;
  listing.missionTypeDerived = resolved.source === "inferred";
  listing.receivedAt = receivedAt(listing);
  return listing;
}

const LIST_COLUMNS = [
  "id",
  "source",
  "external_mission_id",
  "first_seen_at",
  "last_seen_at",
  "status",
  "decline_reason",
  "title",
  "client_name",
  "mission_type",
  "address",
  "latitude",
  "longitude",
  "payout",
  "travel_distance",
  "travel_time",
  "due_window_start",
  "due_window_end",
  "deadline",
  "estimated_on_site_minutes",
  "required_equipment",
  "required_certifications",
  "deliverables",
  "booking_id",
  "bot_accepted_at",
  "admin_notes",
  "tags",
  "cancel_status",
  "cancel_reason",
  "cancel_requested_at",
  "cancelled_at",
  "created_at",
  "updated_at",
].join(", ");

function applyListingFilters(query, filters = {}) {
  if (filters.status === NEEDS_REVIEW) {
    query = query.eq("status", "seen").like("decline_reason", "needs_review%");
  } else if (filters.status === "seen") {
    query = query.eq("status", "seen").or("decline_reason.is.null,decline_reason.not.like.needs_review*");
  } else if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.missionType) query = query.ilike("mission_type", `%${escapeIlike(filters.missionType)}%`);
  if (filters.equipment) query = query.ilike("equipment_search", `%${escapeIlike(filters.equipment)}%`);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.payoutMin !== undefined && filters.payoutMin !== "") {
    query = query.gte("payout", Number(filters.payoutMin));
  }
  if (filters.payoutMax !== undefined && filters.payoutMax !== "") {
    query = query.lte("payout", Number(filters.payoutMax));
  }
  if (filters.distanceMax !== undefined && filters.distanceMax !== "") {
    query = query.lte("travel_distance", Number(filters.distanceMax));
  }
  if (filters.dateFrom) query = query.gte("deadline", filters.dateFrom);
  if (filters.dateTo) query = query.lte("deadline", filters.dateTo);
  if (filters.search) {
    const term = `%${escapeIlike(filters.search)}%`;
    query = query.or(`title.ilike.${term},address.ilike.${term},client_name.ilike.${term},external_mission_id.ilike.${term}`);
  }
  return query;
}

async function attachBookingStatus(listings) {
  const ids = [...new Set(listings.map((listing) => listing?.bookingId).filter(Boolean))];
  if (!ids.length) {
    return listings.map((listing) => ({ ...listing, bookingStatus: null, bookingAcceptedAt: null }));
  }
  const { data, error } = await db().from("bookings").select("id, status, accepted_at").in("id", ids);
  assertNoError(error);
  const byId = new Map((data || []).map((row) => [row.id, row]));
  return listings.map((listing) => {
    const booking = listing.bookingId ? byId.get(listing.bookingId) : null;
    return {
      ...listing,
      bookingStatus: booking?.status || null,
      bookingAcceptedAt: booking?.accepted_at || null,
    };
  });
}

function withWorkComplete(listing, { keepDetail = false } = {}) {
  const bookingStatus = listing.bookingStatus ?? null;
  const workComplete = listingWorkComplete(listing)
    || scheduledFlightLongPast(listing)
    || bookingWorkComplete(bookingStatus);
  if (keepDetail) return { ...listing, bookingStatus, workComplete };
  const { rawDetail, rawEmailText, rawEmailHtml, ...rest } = listing;
  const preview = messagePreview(listing, 280);
  return { ...rest, messagePreview: preview || null, bookingStatus, workComplete };
}

export async function listListings(filters = {}, { sort = "-lastSeenAt", limit = 25, offset = 0 } = {}) {
  let query = db().from("mission_listings").select(`${LIST_COLUMNS}, raw_detail, raw_email_text, flight_plan`, { count: "exact" });
  query = applyListingFilters(query, filters);
  const { column, ascending } = parseSort(sort, "last_seen_at");
  const from = Number(offset) || 0;
  const size = Number(limit) || 25;
  const { data, error, count } = await query.order(column, { ascending }).range(from, from + size - 1);
  assertNoError(error);
  const listings = await attachBookingStatus((data || []).map(mapListing));
  return {
    listings: listings.map((listing) => withWorkComplete(listing)),
    count: count || 0,
  };
}

async function persistKnownFlightWindows(listings) {
  const pending = listings.filter((listing) => {
    if (listing.dueWindowStart || listing.source !== "zeitview") return false;
    return Boolean(knownZeitviewFlight(listing.externalMissionId));
  });
  await Promise.all(pending.map(async (listing) => {
    const flight = knownZeitviewFlight(listing.externalMissionId);
    listing.dueWindowStart = flight.start;
    listing.dueWindowEnd = flight.end;
    const { error } = await db()
      .from("mission_listings")
      .update({
        due_window_start: flight.start,
        due_window_end: flight.end,
      })
      .eq("source", "zeitview")
      .eq("external_mission_id", listing.externalMissionId)
      .is("due_window_start", null);
    assertNoError(error);
  }));
}

export async function listUnlinkedAcceptedListings() {
  const rows = await fetchAll(() =>
    db()
      .from("mission_listings")
      .select("id, source, status, payout, travel_distance, travel_time, deadline, due_window_start, due_window_end, last_seen_at, first_seen_at, booking_id, bot_accepted_at, mission_type, client_name, address, title, external_mission_id, estimated_on_site_minutes, admin_notes, created_at, updated_at, raw_detail, raw_email_text, cancel_status, cancel_reason, cancel_requested_at, cancelled_at")
      .eq("status", "accepted")
      .is("booking_id", null)
  );
  const listings = rows.map(mapListing);
  await persistKnownFlightWindows(listings);
  return listings;
}

export async function findListingById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("mission_listings").select("*").eq("id", id).maybeSingle();
  assertNoError(error);
  const listing = mapListing(data);
  if (!listing) return null;
  const [withStatus] = await attachBookingStatus([listing]);
  return withWorkComplete(withStatus, { keepDetail: true });
}

export async function listLinkedAcceptedListings() {
  const rows = await fetchAll(() =>
    db()
      .from("mission_listings")
      .select("id, booking_id, status, bot_accepted_at, raw_detail, cancel_status, cancel_reason, cancel_requested_at, cancelled_at")
      .eq("status", "accepted")
      .not("booking_id", "is", null)
  );
  return rows.map(mapListing);
}

export async function updateListingCancel(id, { cancelStatus, cancelReason, cancelRequestedAt, cancelledAt }) {
  const { data, error } = await db()
    .from("mission_listings")
    .update({
      cancel_status: cancelStatus,
      cancel_reason: cancelReason,
      cancel_requested_at: cancelRequestedAt,
      cancelled_at: cancelledAt,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  assertNoError(error);
  return mapListing(data);
}

export async function updateListingNotes(id, { adminNotes, tags }) {
  const row = {};
  if (adminNotes !== undefined) row.admin_notes = adminNotes;
  if (tags !== undefined) row.tags = tags;
  const { data, error } = await db()
    .from("mission_listings")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  assertNoError(error);
  return mapListing(data);
}

export async function listingAggregates(filters = {}) {
  const rows = await fetchAll(() =>
    applyListingFilters(
      db().from("mission_listings").select("source, status, mission_type, payout, decline_reason, title, client_name, deliverables, flight_plan, raw_email_text"),
      filters
    )
  );
  // Per-source counts ignore the source filter so every chip keeps its count.
  const sourceRows = filters.source
    ? await fetchAll(() => applyListingFilters(db().from("mission_listings").select("source"), { ...filters, source: undefined }))
    : rows;
  const bySource = {};
  for (const row of sourceRows) {
    const key = row.source || "unknown";
    bySource[key] = (bySource[key] || 0) + 1;
  }

  const byType = {};
  const byStatus = {};
  const byDeclineReason = {};
  let payoutMin = null;
  let payoutMax = null;
  let payoutSum = 0;
  let payoutCount = 0;

  for (const row of rows) {
    const type = deriveMissionType(row) || "Unknown";
    byType[type] = (byType[type] || 0) + 1;
    const status = displayStatus(row.status, row.decline_reason);
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (row.status === "declined_by_filter") {
      const reason = row.decline_reason || "unspecified";
      byDeclineReason[reason] = (byDeclineReason[reason] || 0) + 1;
    }
    const payout = num(row.payout);
    if (payout != null) {
      payoutMin = payoutMin == null ? payout : Math.min(payoutMin, payout);
      payoutMax = payoutMax == null ? payout : Math.max(payoutMax, payout);
      payoutSum += payout;
      payoutCount += 1;
    }
  }

  return {
    total: rows.length,
    bySource,
    byType,
    byStatus,
    byDeclineReason,
    payout: {
      min: payoutMin,
      max: payoutMax,
      avg: payoutCount ? Math.round((payoutSum / payoutCount) * 100) / 100 : null,
      count: payoutCount,
    },
  };
}
