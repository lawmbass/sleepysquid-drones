import { assertNoError, db, escapeIlike, isUuid, parseSort } from "@/libs/db/shared";

export function mapInvitation(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    email: row.email,
    name: row.name,
    company: row.company,
    phone: row.phone,
    role: row.role,
    hasAccess: row.has_access,
    token: row.token,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isExpired: row.expires_at ? new Date(row.expires_at) < new Date() : false,
  };
}

export async function findInvitationById(id) {
  if (!isUuid(id)) return null;
  const { data, error } = await db().from("invitations").select("*").eq("id", id).maybeSingle();
  assertNoError(error);
  return mapInvitation(data);
}

export async function findValidInvitation(token) {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", now)
    .maybeSingle();
  assertNoError(error);
  return mapInvitation(data);
}

export async function findPendingInvitationByEmail(email) {
  const { data, error } = await db()
    .from("invitations")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("status", "pending")
    .maybeSingle();
  assertNoError(error);
  return mapInvitation(data);
}

export async function findRecentAcceptedInvitation(email, since) {
  const { data, error } = await db()
    .from("invitations")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("status", "accepted")
    .gte("accepted_at", since)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  return mapInvitation(data);
}

export async function findInvitationByEmail(email) {
  const { data, error } = await db()
    .from("invitations")
    .select("*")
    .eq("email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  return mapInvitation(data);
}

export async function listPendingInvitations({ search, sort = "-createdAt" } = {}) {
  let query = db().from("invitations").select("*").eq("status", "pending");
  if (search) {
    const term = `%${escapeIlike(search)}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},company.ilike.${term}`);
  }
  const { column, ascending } = parseSort(sort, "created_at");
  const sortColumn = column === "created_at" ? "invited_at" : column;
  const { data, error } = await query.order(sortColumn, { ascending });
  assertNoError(error);
  return (data || []).map(mapInvitation);
}

export async function countPendingInvitations({ search } = {}) {
  let query = db().from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (search) {
    const term = `%${escapeIlike(search)}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},company.ilike.${term}`);
  }
  const { count, error } = await query;
  assertNoError(error);
  return count || 0;
}

export async function pendingInvitationRoleCounts() {
  const { data, error } = await db().from("invitations").select("role").eq("status", "pending");
  assertNoError(error);
  const counts = { admin: 0, client: 0, pilot: 0, user: 0 };
  for (const row of data || []) {
    if (Object.prototype.hasOwnProperty.call(counts, row.role)) {
      counts[row.role] += 1;
    }
  }
  return counts;
}

export async function createInvitation(input) {
  const { data, error } = await db()
    .from("invitations")
    .insert({
      email: input.email.toLowerCase(),
      name: input.name,
      company: input.company || null,
      phone: input.phone || null,
      role: input.role || "client",
      has_access: input.hasAccess || false,
      token: input.token,
      invited_by: input.invitedBy,
      expires_at: input.expiresAt,
      status: "pending",
    })
    .select("*")
    .single();
  assertNoError(error);
  return mapInvitation(data);
}

export async function updateInvitation(id, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.company !== undefined) row.company = patch.company;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.hasAccess !== undefined) row.has_access = patch.hasAccess;
  if (patch.invitedBy !== undefined) row.invited_by = patch.invitedBy;
  if (patch.invitedAt !== undefined) row.invited_at = patch.invitedAt;
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
  if (patch.acceptedAt !== undefined) row.accepted_at = patch.acceptedAt;
  if (patch.status !== undefined) row.status = patch.status;

  const { data, error } = await db()
    .from("invitations")
    .update(row)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  assertNoError(error);
  return mapInvitation(data);
}

export async function deleteInvitation(id) {
  const { error } = await db().from("invitations").delete().eq("id", id);
  assertNoError(error);
}
