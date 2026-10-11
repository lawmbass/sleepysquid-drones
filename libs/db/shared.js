import { getSupabaseAdmin } from "@/libs/supabase";

export class DbError extends Error {
  constructor(error) {
    super(error?.message || "Database error");
    this.name = "DbError";
    this.code = error?.code || null;
    this.details = error?.details || null;
  }
}

export function assertNoError(error) {
  if (error) {
    throw new DbError(error);
  }
}

export function isUniqueViolation(error) {
  return error?.code === "23505";
}

export function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function escapeIlike(value) {
  return String(value).replace(/[%_\\,]/g, "");
}

export function db() {
  return getSupabaseAdmin();
}

const SORT_COLUMNS = {
  createdAt: "created_at",
  updatedAt: "updated_at",
  date: "date",
  name: "name",
  email: "email",
  status: "status",
  payout: "payout",
  invitedAt: "invited_at",
  lastSeenAt: "last_seen_at",
  firstSeenAt: "first_seen_at",
  deadline: "deadline",
  travelDistance: "travel_distance",
  missionType: "mission_type",
  title: "title",
};

export function parseSort(sort = "-createdAt", fallback = "created_at") {
  const raw = String(sort || `-${fallback}`);
  const descending = raw.startsWith("-");
  const key = descending ? raw.slice(1) : raw;
  return {
    column: SORT_COLUMNS[key] || fallback,
    ascending: !descending,
  };
}

export async function fetchAll(buildQuery) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;

  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    assertNoError(error);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
