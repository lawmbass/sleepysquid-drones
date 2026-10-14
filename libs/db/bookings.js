import { assertNoError, db, escapeIlike, fetchAll, isUuid, num, parseSort } from "@/libs/db/shared";
import { MANUAL_SOURCE, isMissionSource } from "@/libs/manualBooking";

export function mapBooking(row) {
  if (!row) return null;

  const payout = num(row.payout);
  const estimatedPrice = num(row.estimated_price);
  const finalPrice = num(row.final_price);
  const isMission = isMissionSource(row.source);
  const hasCoordinates = row.latitude !== null && row.latitude !== undefined
    || row.longitude !== null && row.longitude !== undefined;

  return {
    id: row.id,
    _id: row.id,
    source: row.source,
    service: row.service,
    package: row.package,
    missionId: row.mission_id,
    payout,
    travelDistance: num(row.travel_distance),
    travelTime: num(row.travel_time),
    duration: num(row.duration),
    acceptedAt: row.accepted_at,
    missionEmail: row.mission_email,
    coordinates: hasCoordinates
      ? { lat: num(row.latitude), lng: num(row.longitude) }
      : null,
    date: row.date,
    location: row.location,
    details: row.details || "",
    name: row.name,
    email: row.email,
    phone: row.phone,
    estimatedPrice,
    finalPrice,
    appliedPromo: row.applied_promo,
    status: row.status,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    adminNotes: row.admin_notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMission,
    displayPrice: isMission && payout != null ? payout : (finalPrice ?? estimatedPrice ?? 0),
  };
}

function applyBookingFilters(query, filters = {}) {
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.service) query = query.eq("service", filters.service);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.email) query = query.ilike("email", `%${escapeIlike(filters.email)}%`);
  if (filters.emailExact) query = query.eq("email", filters.emailExact.toLowerCase());
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);
  if (filters.payoutMin !== undefined && filters.payoutMin !== null && filters.payoutMin !== "") {
    query = query.gte("payout", Number(filters.payoutMin));
  }
  if (filters.payoutMax !== undefined && filters.payoutMax !== null && filters.payoutMax !== "") {
    query = query.lte("payout", Number(filters.payoutMax));
  }
  if (filters.travelDistanceMax !== undefined && filters.travelDistanceMax !== null && filters.travelDistanceMax !== "") {
    query = query.lte("travel_distance", Number(filters.travelDistanceMax));
  }
  if (filters.customerOnly) {
    query = query.or("source.eq.customer,source.is.null");
  }
  if (filters.missionsOnly) {
    query = query.neq("source", "customer").neq("source", MANUAL_SOURCE);
  }
  if (filters.travelDistancePresent) {
    query = query.not("travel_distance", "is", null);
  }
  return query;
}

function bookingInsertRow(input) {
  const coordinates = input.coordinates || {};
  return {
    source: input.source || "customer",
    service: input.service,
    package: input.package || null,
    mission_id: input.missionId || null,
    payout: input.payout ?? null,
    travel_distance: input.travelDistance ?? null,
    travel_time: input.travelTime ?? null,
    duration: input.duration ?? null,
    accepted_at: input.acceptedAt || null,
    mission_email: input.missionEmail || null,
    latitude: coordinates.lat ?? input.latitude ?? null,
    longitude: coordinates.lng ?? input.longitude ?? null,
    date: input.date,
    location: input.location,
    details: input.details || "",
    name: input.name || null,
    email: input.email ? input.email.toLowerCase() : null,
    phone: input.phone || null,
    estimated_price: input.estimatedPrice ?? null,
    final_price: input.finalPrice ?? null,
    applied_promo: input.appliedPromo ?? null,
    status: input.status || "pending",
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
    admin_notes: input.adminNotes || "",
  };
}

const BOOKING_PATCH_COLUMNS = {
  status: "status",
  estimatedPrice: "estimated_price",
  finalPrice: "final_price",
  adminNotes: "admin_notes",
  service: "service",
  package: "package",
  date: "date",
  location: "location",
  details: "details",
  phone: "phone",
  name: "name",
  email: "email",
  payout: "payout",
  source: "source",
};

export async function insertBooking(input) {
  const { data, error } = await db()
    .from("bookings")
    .insert(bookingInsertRow(input))
    .select("*")
    .single();
  assertNoError(error);
  return mapBooking(data);
}

export async function findBookingById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("bookings").select("*").eq("id", id).maybeSingle();
  assertNoError(error);
  return mapBooking(data);
}

export async function findCustomerBooking(id, email) {
  if (!isUuid(id)) return null;
  let query = db()
    .from("bookings")
    .select("*")
    .eq("id", id)
    .eq("email", email.toLowerCase());
  query = applyBookingFilters(query, { customerOnly: true });
  const { data, error } = await query.maybeSingle();
  assertNoError(error);
  return mapBooking(data);
}

export async function findSameDayBooking(email, startOfDay, endOfDay) {
  const { data, error } = await db()
    .from("bookings")
    .select("id")
    .eq("email", email.toLowerCase())
    .gte("date", startOfDay)
    .lte("date", endOfDay)
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  return data;
}

export async function updateBooking(id, patch) {
  const row = {};
  for (const [key, column] of Object.entries(BOOKING_PATCH_COLUMNS)) {
    if (patch[key] !== undefined) {
      row[column] = key === "email" && patch[key] ? patch[key].toLowerCase() : patch[key];
    }
  }

  const { data, error } = await db()
    .from("bookings")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  assertNoError(error);
  return mapBooking(data);
}

export async function deleteBooking(id) {
  const { error } = await db().from("bookings").delete().eq("id", id);
  assertNoError(error);
}

export async function listBookings(filters = {}, { sort = "-createdAt", limit = 50, offset = 0 } = {}) {
  let query = db().from("bookings").select("*", { count: "exact" });
  query = applyBookingFilters(query, filters);
  const { column, ascending } = parseSort(sort);
  const from = Number(offset) || 0;
  const size = Number(limit) || 50;
  const { data, error, count } = await query
    .order(column, { ascending })
    .range(from, from + size - 1);
  assertNoError(error);
  return {
    bookings: (data || []).map(mapBooking),
    count: count || 0,
  };
}

export async function listAllBookings(filters = {}) {
  const rows = await fetchAll(() => applyBookingFilters(db().from("bookings").select("*"), filters));
  return rows.map(mapBooking);
}

export function displayValue(booking) {
  if (booking.payout != null) return Number(booking.payout) || 0;
  return Number(booking.finalPrice ?? booking.estimatedPrice ?? 0) || 0;
}

export async function pingBookings() {
  const { error } = await db().from("bookings").select("id", { head: true, count: "exact" });
  assertNoError(error);
}
