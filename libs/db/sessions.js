import { assertNoError, db } from "@/libs/db/shared";
import { isMissingSessionsTable } from "@/libs/userDeletion";

/**
 * NextAuth on this app stores JWT sessions in the browser cookie, not in
 * Postgres. A sessions table is still deleted when one exists, so an older
 * database adapter row cannot keep the account signed in.
 */
export { isMissingSessionsTable };

export async function deleteSessionsForUser(userId) {
  const { error } = await db().from("sessions").delete().eq("user_id", userId);
  if (isMissingSessionsTable(error)) {
    return { removed: false, reason: "no-sessions-table" };
  }
  assertNoError(error);
  return { removed: true };
}
