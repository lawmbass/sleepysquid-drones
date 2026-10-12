import { adminConfig } from "@/libs/adminConfig";
import { patchUser } from "@/libs/db/users";

export const ADMIN_ROLE_REASON = "Email is in ADMIN_EMAILS or ends with @sleepysquid.com";

export function roleForNewUser(email, fallback = "client") {
  return adminConfig.isAdmin(email) ? "admin" : fallback;
}

/**
 * Persist role admin when the email matches the admin rule.
 * No-op when the row is already admin or the email does not qualify.
 */
export async function ensureAdminRole(user) {
  if (!user?.id || user.role === "admin" || !adminConfig.isAdmin(user.email)) {
    return user;
  }

  return patchUser(user.id, {
    role: "admin",
    pushRoleHistory: {
      role: "admin",
      changedAt: new Date().toISOString(),
      changedBy: "system",
      reason: ADMIN_ROLE_REASON,
    },
  });
}
