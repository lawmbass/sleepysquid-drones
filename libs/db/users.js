import { assertNoError, db, escapeIlike, fetchAll, isUuid, num, parseSort } from "@/libs/db/shared";

const DEFAULT_PREFERENCES = {
  theme: "light",
  language: "en",
  timezone: "UTC",
  dateFormat: "MM/DD/YYYY",
  currency: "USD",
};

const DEFAULT_NOTIFICATIONS = {
  emailNotifications: true,
  pushNotifications: true,
  bookingUpdates: true,
  bookingConfirmations: true,
  statusUpdates: true,
  marketingEmails: false,
  weeklyReports: true,
  securityAlerts: true,
};

export function mapUser(row, { includeSecrets = false } = {}) {
  if (!row) return null;

  const user = {
    id: row.id,
    _id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role || "client",
    customerId: row.customer_id,
    priceId: row.price_id,
    hasAccess: row.has_access || false,
    phone: row.phone,
    company: row.company,
    bio: row.bio,
    location: row.location,
    website: row.website,
    preferences: { ...DEFAULT_PREFERENCES, ...(row.preferences || {}) },
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(row.notifications || {}) },
    twoFactorEnabled: row.two_factor_enabled || false,
    roleHistory: row.role_history || [],
    accessHistory: row.access_history || [],
    emailVerification: {
      verified: row.email_verified || false,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeSecrets) {
    user.password = row.password_hash || null;
    user.emailVerification.token = row.email_verification_token;
    user.emailVerification.expires = row.email_verification_expires;
    user.passwordReset = {
      token: row.password_reset_token,
      expires: row.password_reset_expires,
      requestedAt: row.password_reset_requested_at,
    };
    user.pendingEmailChange = {
      email: row.pending_email,
      token: row.pending_email_token,
      expires: row.pending_email_expires,
    };
    user.twoFactorSecret = row.two_factor_secret;
  }

  return user;
}

function userSelect() {
  return db().from("users");
}

export async function findUserById(id, options = {}) {
  if (!isUuid(id)) return null;
  const { data, error } = await userSelect().select("*").eq("id", id).maybeSingle();
  assertNoError(error);
  return mapUser(data, options);
}

export async function findUserByEmail(email, options = {}) {
  if (!email) return null;
  const { data, error } = await userSelect()
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  assertNoError(error);
  return mapUser(data, options);
}

export async function findUserByEmailVerificationToken(token) {
  const now = new Date().toISOString();
  const { data, error } = await userSelect()
    .select("*")
    .eq("email_verification_token", token)
    .gt("email_verification_expires", now)
    .maybeSingle();
  assertNoError(error);
  return mapUser(data, { includeSecrets: true });
}

export async function findUserByPasswordResetToken(token) {
  const { data, error } = await userSelect()
    .select("*")
    .eq("password_reset_token", token)
    .maybeSingle();
  assertNoError(error);
  return mapUser(data, { includeSecrets: true });
}

export async function findUserByPendingEmailToken(token) {
  const now = new Date().toISOString();
  const { data, error } = await userSelect()
    .select("*")
    .eq("pending_email_token", token)
    .gt("pending_email_expires", now)
    .maybeSingle();
  assertNoError(error);
  return mapUser(data, { includeSecrets: true });
}

function rowFromCreate(input) {
  const emailVerification = input.emailVerification || {};
  return {
    name: input.name || null,
    email: input.email.toLowerCase(),
    image: input.image || null,
    role: input.role || "client",
    customer_id: input.customerId || null,
    price_id: input.priceId || null,
    has_access: input.hasAccess || false,
    phone: input.phone || null,
    company: input.company || null,
    bio: input.bio || null,
    location: input.location || null,
    website: input.website || null,
    preferences: input.preferences || DEFAULT_PREFERENCES,
    notifications: input.notifications || DEFAULT_NOTIFICATIONS,
    password_hash: input.password || null,
    two_factor_enabled: input.twoFactorEnabled || false,
    email_verified: emailVerification.verified || false,
    email_verification_token: emailVerification.token || null,
    email_verification_expires: emailVerification.expires || null,
    role_history: input.roleHistory || [],
    access_history: input.accessHistory || [],
  };
}

export async function createUser(input) {
  const { data, error } = await userSelect().insert(rowFromCreate(input)).select("*").single();
  assertNoError(error);
  return mapUser(data);
}

async function currentHistory(id) {
  const { data, error } = await userSelect()
    .select("role_history, access_history")
    .eq("id", id)
    .single();
  assertNoError(error);
  return {
    roleHistory: data.role_history || [],
    accessHistory: data.access_history || [],
  };
}

export async function patchUser(id, patch) {
  const row = {};

  const direct = {
    name: "name",
    email: "email",
    image: "image",
    role: "role",
    customerId: "customer_id",
    priceId: "price_id",
    hasAccess: "has_access",
    phone: "phone",
    company: "company",
    bio: "bio",
    location: "location",
    website: "website",
    preferences: "preferences",
    notifications: "notifications",
    password: "password_hash",
    twoFactorEnabled: "two_factor_enabled",
    twoFactorSecret: "two_factor_secret",
    roleHistory: "role_history",
    accessHistory: "access_history",
  };

  for (const [key, column] of Object.entries(direct)) {
    if (patch[key] !== undefined) {
      row[column] = patch[key];
    }
  }

  if (patch.emailVerification) {
    const verification = patch.emailVerification;
    if (verification.verified !== undefined) row.email_verified = verification.verified;
    if (verification.token !== undefined) row.email_verification_token = verification.token;
    if (verification.expires !== undefined) row.email_verification_expires = verification.expires;
  }

  if (patch.passwordReset === null) {
    row.password_reset_token = null;
    row.password_reset_expires = null;
    row.password_reset_requested_at = null;
  } else if (patch.passwordReset) {
    const reset = patch.passwordReset;
    if (reset.token !== undefined) row.password_reset_token = reset.token;
    if (reset.expires !== undefined) row.password_reset_expires = reset.expires;
    if (reset.requestedAt !== undefined) row.password_reset_requested_at = reset.requestedAt;
  }

  if (patch.pendingEmailChange === null) {
    row.pending_email = null;
    row.pending_email_token = null;
    row.pending_email_expires = null;
  } else if (patch.pendingEmailChange) {
    const pending = patch.pendingEmailChange;
    if (pending.email !== undefined) row.pending_email = pending.email;
    if (pending.token !== undefined) row.pending_email_token = pending.token;
    if (pending.expires !== undefined) row.pending_email_expires = pending.expires;
  }

  if (patch.pushRoleHistory || patch.pushAccessHistory) {
    const history = await currentHistory(id);
    if (patch.pushRoleHistory) {
      row.role_history = [...history.roleHistory, patch.pushRoleHistory];
    }
    if (patch.pushAccessHistory) {
      row.access_history = [...history.accessHistory, patch.pushAccessHistory];
    }
  }

  if (Object.keys(row).length === 0) {
    return findUserById(id, { includeSecrets: true });
  }

  const { data, error } = await userSelect().update(row).eq("id", id).select("*").maybeSingle();
  assertNoError(error);
  return mapUser(data);
}

export async function deleteUser(id) {
  const { error } = await userSelect().delete().eq("id", id);
  assertNoError(error);
}

// Lowercased emails (from the given list) that have a user account. Used to show an AI client and
// its matching account as one row in User Management.
export async function emailsWithAccounts(emails) {
  const list = [...new Set((emails || []).map((e) => String(e).toLowerCase()).filter(Boolean))];
  if (!list.length) return new Set();
  const { data, error } = await userSelect().select("email").in("email", list);
  assertNoError(error);
  return new Set((data || []).map((r) => String(r.email).toLowerCase()));
}

export async function listUserAdminFields() {
  const rows = await fetchAll(() => userSelect().select("id, email, role"));
  return (rows || []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role || "client",
  }));
}

export async function listUsers({ search, hasAccess, role, sort = "-createdAt", limit = 50, offset = 0 } = {}) {
  let query = userSelect().select("*", { count: "exact" });

  if (search) {
    const term = `%${escapeIlike(search)}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},company.ilike.${term}`);
  }
  if (hasAccess !== undefined && hasAccess !== null && hasAccess !== "") {
    query = query.eq("has_access", hasAccess === true || hasAccess === "true");
  }
  if (role) {
    query = query.eq("role", role);
  }

  const { column, ascending } = parseSort(sort);
  const from = Number(offset) || 0;
  const to = from + (Number(limit) || 50) - 1;
  const { data, error, count } = await query.order(column, { ascending }).range(from, to);
  assertNoError(error);
  return {
    users: (data || []).map((row) => mapUser(row)),
    count: count || 0,
  };
}

export async function countUsers({ search, hasAccess } = {}) {
  let query = userSelect().select("id", { count: "exact", head: true });
  if (search) {
    const term = `%${escapeIlike(search)}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},company.ilike.${term}`);
  }
  if (hasAccess !== undefined && hasAccess !== null && hasAccess !== "") {
    query = query.eq("has_access", hasAccess === true || hasAccess === "true");
  }
  const { count, error } = await query;
  assertNoError(error);
  return count || 0;
}

export async function userAccessAndRoleStats() {
  const rows = await fetchAll(() => userSelect().select("has_access, role"));
  const access = { withAccess: 0, withoutAccess: 0 };
  const roles = { admin: 0, client: 0, pilot: 0, user: 0 };
  for (const row of rows) {
    if (row.has_access) access.withAccess += 1;
    else access.withoutAccess += 1;
    if (Object.prototype.hasOwnProperty.call(roles, row.role)) {
      roles[row.role] += 1;
    }
  }
  return { access, roles, total: rows.length };
}

export async function findUserByEmailExcluding(email, excludeId) {
  const { data, error } = await userSelect()
    .select("*")
    .eq("email", email.toLowerCase())
    .neq("id", excludeId)
    .maybeSingle();
  assertNoError(error);
  return mapUser(data);
}

export { num };

// Settings for AI clients who signed in by email link and have no users row yet: create a plain client
// row on first use so Profile/Preferences/Notifications/Security load and save like everyone else's.
export async function findOrCreateSettingsUser(sessionUser, options = {}) {
  const email = String(sessionUser?.email || "").toLowerCase();
  if (!email) return null;
  const existing = await findUserByEmail(email, options);
  if (existing || !sessionUser?.aiClient) return existing;
  try {
    await createUser({ email, name: sessionUser.name || null, role: "client", hasAccess: true, emailVerification: { verified: true } });
  } catch (e) { /* lost a race with a concurrent create */ }
  return findUserByEmail(email, options);
}
