import { adminConfig } from "./adminConfig.js";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** A dashboard admin is a user with role admin, or an email the admin rule already accepts. */
export function isDashboardAdminAccount(user) {
  if (!user) return false;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  return adminConfig.isAdmin(user.email);
}

/**
 * Whether an admin may delete this account.
 * Refuses the signed-in account, and refuses the last remaining admin.
 * Bookings and missions are not part of this decision.
 */
export function userDeletionDecision({ actorEmail, target, admins = [] } = {}) {
  if (!target) {
    return {
      allowed: false,
      status: 404,
      error: "User not found",
      message: "The requested user does not exist",
    };
  }

  const actor = normalizeEmail(actorEmail);
  const targetEmail = normalizeEmail(target.email);
  if (actor && targetEmail && actor === targetEmail) {
    return {
      allowed: false,
      status: 400,
      error: "Invalid operation",
      message: "Cannot delete your own account",
    };
  }

  if (isDashboardAdminAccount(target)) {
    const otherAdmins = admins.filter((admin) => {
      if (!isDashboardAdminAccount(admin)) return false;
      return normalizeEmail(admin.email) !== targetEmail;
    });
    if (otherAdmins.length < 1) {
      return {
        allowed: false,
        status: 400,
        error: "Invalid operation",
        message: "Cannot delete the last admin",
      };
    }
  }

  return { allowed: true };
}

/** PostgREST and Postgres both say this when public.sessions was never created. */
export function isMissingSessionsTable(error) {
  if (!error) return false;
  const code = error.code;
  const message = `${error.message || ""} ${error.details || ""}`;
  return code === "PGRST205"
    || code === "42P01"
    || /schema cache|does not exist|could not find the table/i.test(message);
}
