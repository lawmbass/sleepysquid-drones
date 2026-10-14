import assert from "node:assert/strict";
import fs from "node:fs";

process.env.ADMIN_EMAILS = "lawrence@sleepysquid.com";

const { adminConfig } = await import("../libs/adminConfig.js");
const { userDeletionDecision, offerUserDelete, isDashboardAdminAccount, isMissingSessionsTable } = await import("../libs/userDeletion.js");

adminConfig.reloadFromEnv();

const lawrence = { id: "1", email: "lawrence@sleepysquid.com", role: "admin" };
const gmailAdmin = { id: "2", email: "lawmbass1@gmail.com", role: "admin" };
const client = { id: "3", email: "client@example.com", role: "client" };
const admins = [lawrence, gmailAdmin, client];

const allowed = userDeletionDecision({
  actorEmail: "Lawrence@SleepySquid.com",
  target: gmailAdmin,
  admins,
});
assert.equal(allowed.allowed, true);

const self = userDeletionDecision({
  actorEmail: "lawrence@sleepysquid.com",
  target: lawrence,
  admins,
});
assert.equal(self.allowed, false);
assert.equal(self.status, 400);
assert.equal(self.message, "Cannot delete your own account");

const lastAdmin = userDeletionDecision({
  actorEmail: "pilot@example.com",
  target: lawrence,
  admins: [lawrence, client],
});
assert.equal(lastAdmin.allowed, false);
assert.equal(lastAdmin.message, "Cannot delete the last admin");

const clientDelete = userDeletionDecision({
  actorEmail: lawrence.email,
  target: client,
  admins: [lawrence],
});
assert.equal(clientDelete.allowed, true);

const missing = userDeletionDecision({
  actorEmail: lawrence.email,
  target: null,
  admins,
});
assert.equal(missing.status, 404);
assert.equal(offerUserDelete({ actorEmail: lawrence.email, target: gmailAdmin, admins }), true);
assert.equal(offerUserDelete({ actorEmail: lawrence.email, target: lawrence, admins }), false);
assert.equal(offerUserDelete({ actorEmail: lawrence.email, target: lawrence, admins: [lawrence] }), false);

process.env.ADMIN_EMAILS = "lawrence@sleepysquid.com,lawmbass1@gmail.com";
adminConfig.reloadFromEnv();
const gmailClientRole = { id: "2", email: "lawmbass1@gmail.com", role: "client" };
assert.equal(isDashboardAdminAccount(gmailClientRole), true);
assert.equal(userDeletionDecision({
  actorEmail: lawrence.email,
  target: gmailClientRole,
  admins: [lawrence, gmailClientRole],
}).allowed, true);
assert.equal(userDeletionDecision({
  actorEmail: lawrence.email,
  target: gmailClientRole,
  admins: [gmailClientRole],
}).message, "Cannot delete the last admin");

assert.equal(isMissingSessionsTable({ code: "PGRST205", message: "Could not find the table 'public.sessions' in the schema cache" }), true);
assert.equal(isMissingSessionsTable({ code: "42P01", message: 'relation "sessions" does not exist' }), true);
assert.equal(isMissingSessionsTable({ code: "23503", message: "bookings still reference this user" }), false);

const route = fs.readFileSync(new URL("../pages/api/admin/users/[id].js", import.meta.url), "utf8");
assert.match(route, /deleteOAuthAccountsForUser/);
assert.match(route, /deleteSessionsForUser/);
assert.match(route, /deleteUser\(id\)/);
assert.doesNotMatch(route, /Cannot delete admin users/);
assert.doesNotMatch(route, /\.from\(["']bookings["']\)/);
assert.doesNotMatch(route, /\.from\(["']mission_listings["']\)/);

const list = fs.readFileSync(new URL("../components/admin/UsersList.jsx", import.meta.url), "utf8");
const modal = fs.readFileSync(new URL("../components/admin/UserModal.jsx", import.meta.url), "utf8");
assert.match(list, /Delete user/);
assert.match(list, /user\.canDelete/);
assert.match(list, /Delete \$\{confirmDialog\.user\?\.email\}\?/);
assert.doesNotMatch(list, /Edit User/);
assert.doesNotMatch(list, /user\.role !== 'admin'/);
assert.match(modal, /user\?\.canDelete/);
assert.match(modal, /Delete \$\{user\?\.email\}\?/);
const usersRoute = fs.readFileSync(new URL("../pages/api/admin/users.js", import.meta.url), "utf8");
assert.match(usersRoute, /canDelete: offerUserDelete/);

console.log("User deletion checks passed.");
