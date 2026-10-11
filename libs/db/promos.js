import { assertNoError, db, isUuid } from "@/libs/db/shared";
import { findUserById } from "@/libs/db/users";

export function calculateDiscountedPrice(discountPercentage, originalPrice) {
  const discount = (originalPrice * Number(discountPercentage)) / 100;
  return Math.round(originalPrice - discount);
}

export function mapPromo(row, creator) {
  if (!row) return null;
  const now = new Date();
  const start = new Date(row.start_date);
  const end = new Date(row.end_date);
  const isCurrentlyActive = Boolean(row.is_active) && start <= now && end >= now;

  let createdBy = null;
  if (creator) {
    createdBy = {
      id: creator.id,
      _id: creator.id,
      name: creator.name,
      email: creator.email,
    };
  } else if (row.created_by_email) {
    createdBy = { email: row.created_by_email };
  }

  return {
    id: row.id,
    _id: row.id,
    name: row.name,
    description: row.description,
    discountPercentage: Number(row.discount_percentage),
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    isCurrentlyActive,
    createdBy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function withCreator(row) {
  if (!row) return null;
  const creator = row.created_by ? await findUserById(row.created_by) : null;
  return mapPromo(row, creator);
}

export async function getActivePromo() {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("promos")
    .select("*")
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  return withCreator(data);
}

export async function findOverlappingPromo(start, end, excludeId) {
  let query = db()
    .from("promos")
    .select("*")
    .eq("is_active", true)
    .lte("start_date", end)
    .gte("end_date", start);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1).maybeSingle();
  assertNoError(error);
  return data ? mapPromo(data) : null;
}

export async function listPromos({ status, limit = 20, offset = 0 } = {}) {
  const now = new Date().toISOString();
  let query = db().from("promos").select("*", { count: "exact" });

  if (status === "active") {
    query = query.eq("is_active", true).lte("start_date", now).gte("end_date", now);
  } else if (status === "inactive") {
    query = query.eq("is_active", false);
  } else if (status === "expired") {
    query = query.eq("is_active", true).lt("end_date", now);
  } else if (status === "upcoming") {
    query = query.eq("is_active", true).gt("start_date", now);
  }

  const from = Number(offset) || 0;
  const size = Number(limit) || 20;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);
  assertNoError(error);

  const promos = [];
  for (const row of data || []) {
    promos.push(await withCreator(row));
  }
  return { promos, count: count || 0 };
}

export async function findPromoById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("promos").select("*").eq("id", id).maybeSingle();
  assertNoError(error);
  return withCreator(data);
}

export async function createPromo(input) {
  const createdBy = isUuid(input.createdBy) ? input.createdBy : null;
  const { data, error } = await db()
    .from("promos")
    .insert({
      name: input.name,
      description: input.description || null,
      discount_percentage: Number(input.discountPercentage),
      start_date: input.startDate,
      end_date: input.endDate,
      is_active: input.isActive !== undefined ? input.isActive : true,
      created_by: createdBy,
      created_by_email: input.createdByEmail || null,
    })
    .select("*")
    .single();
  assertNoError(error);
  return withCreator(data);
}

export async function updatePromo(id, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.discountPercentage !== undefined) row.discount_percentage = Number(patch.discountPercentage);
  if (patch.startDate !== undefined) row.start_date = patch.startDate;
  if (patch.endDate !== undefined) row.end_date = patch.endDate;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { data, error } = await db()
    .from("promos")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  assertNoError(error);
  return withCreator(data);
}

export async function deletePromo(id) {
  const { error } = await db().from("promos").delete().eq("id", id);
  assertNoError(error);
}
