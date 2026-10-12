import { assertNoError, db, escapeIlike, fetchAll, isUuid, num, parseSort } from "@/libs/db/shared";

export function mapListing(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    source: row.source,
    externalMissionId: row.external_mission_id,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    status: row.status,
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
    adminNotes: row.admin_notes || "",
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  "admin_notes",
  "tags",
  "created_at",
  "updated_at",
].join(", ");

function applyListingFilters(query, filters = {}) {
  if (filters.status) query = query.eq("status", filters.status);
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

export async function listListings(filters = {}, { sort = "-lastSeenAt", limit = 25, offset = 0 } = {}) {
  let query = db().from("mission_listings").select(LIST_COLUMNS, { count: "exact" });
  query = applyListingFilters(query, filters);
  const { column, ascending } = parseSort(sort, "last_seen_at");
  const from = Number(offset) || 0;
  const size = Number(limit) || 25;
  const { data, error, count } = await query.order(column, { ascending }).range(from, from + size - 1);
  assertNoError(error);
  return {
    listings: (data || []).map(mapListing),
    count: count || 0,
  };
}

export async function listUnlinkedAcceptedListings() {
  const rows = await fetchAll(() =>
    db()
      .from("mission_listings")
      .select("id, source, status, payout, travel_distance, travel_time, deadline, due_window_start, due_window_end, last_seen_at, first_seen_at, booking_id, mission_type, client_name, address, title, external_mission_id, estimated_on_site_minutes, admin_notes, created_at, updated_at")
      .eq("status", "accepted")
      .is("booking_id", null)
  );
  return rows.map(mapListing);
}

export async function findListingById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("mission_listings").select("*").eq("id", id).maybeSingle();
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
      db().from("mission_listings").select("status, mission_type, payout, decline_reason"),
      filters
    )
  );

  const byType = {};
  const byStatus = {};
  const byDeclineReason = {};
  let payoutMin = null;
  let payoutMax = null;
  let payoutSum = 0;
  let payoutCount = 0;

  for (const row of rows) {
    const type = row.mission_type || "Unknown";
    byType[type] = (byType[type] || 0) + 1;
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
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
