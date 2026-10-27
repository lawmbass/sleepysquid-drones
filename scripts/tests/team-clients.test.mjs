import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TEAM_ROLES, teamStats } from "../../libs/team.mjs";
import { canInvite, canRemoveLogin, hasLogin, portalStatus, publicClient, removeLoginText, rowActionsFor } from "../../libs/clients/core.mjs";

const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const base = { id: "c1", businessName: "Acme", email: "a@acme.co", services: [], aiLogins: [] };

test("Team: staff roles only, stats count team rows only", () => {
  assert.deepEqual(TEAM_ROLES, ["admin", "pilot"]);
  const s = teamStats([{ role: "admin", hasAccess: true }, { role: "pilot", hasAccess: false }, { role: "pilot", isPendingInvitation: true }]);
  assert.deepEqual(s, { total: 3, users: 2, pendingInvitations: 1, withAccess: 1, withoutAccess: 1, roles: { admin: 1, pilot: 2, client: 0 } });
  const api = read("pages/api/admin/users.js");
  assert.match(api, /TEAM_ROLES\.includes\(item\.role\)/);
});

test("Team: nav, page, add-member roles, old users links redirect", () => {
  assert.match(read("libs/userRoles.js"), /name: 'Team', href: '\/dashboard\?section=team'/);
  assert.doesNotMatch(read("libs/userRoles.js"), /name: 'Users'/);
  const dash = read("pages/dashboard.js");
  assert.match(dash, /requestedSection === 'users'\) \{ router\.replace\(isDashboardAdmin \? '\/dashboard\?section=team'/);
  assert.match(dash, /requestedSection === 'ai-admin'\) \{ router\.replace\(isDashboardAdmin \? '\/dashboard\?section=clients'/);
  assert.match(read("components/dashboard/AdminContent.jsx"), /case 'team':\s*\n[\s\S]*?<TeamManagement \/>/);
  const team = read("components/admin/TeamManagement.jsx");
  assert.match(team, /new URLSearchParams\(\{ team: '1' \}\)/);
  assert.match(team, /Add team member/);
  assert.doesNotMatch(team, /AiClient|useAiClients|New invoice/);
  const modal = read("components/admin/UserModal.jsx");
  const opts = [...modal.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(opts, ["pilot", "admin"]);
  assert.doesNotMatch(modal, /AiClientFields|aiCall/);
  assert.doesNotMatch(read("components/admin/UserFilters.jsx"), /value="client"/);
  const list = read("components/admin/UsersList.jsx");
  assert.doesNotMatch(list, /New invoice|AiClientControls|aiOnly/);
  assert.match(list, /Delete user/);
  assert.match(list, /onEditUser\(user\)/);
});

test("Clients: login status, Invite and Remove login", () => {
  assert.equal(portalStatus({ ...base, userId: "u" }).label, "Has login");
  assert.equal(portalStatus({ ...base, aiLogins: ["a@acme.co"] }).label, "AI login");
  assert.equal(portalStatus({ ...base, invitedAt: "2026-10-01T12:00:00Z" }).key, "invited");
  assert.equal(portalStatus(base).label, "No login");
  assert.equal(hasLogin({ ...base, aiLogins: ["a@acme.co"] }), true);
  assert.equal(canRemoveLogin(base), false);
  assert.equal(canRemoveLogin({ ...base, invitedAt: "2026-10-01" }), true);
  assert.deepEqual(rowActionsFor({ ...base, userId: "u" }), ["invoice", "remove-login", "edit", "archive"]);
  assert.deepEqual(rowActionsFor(base), ["invoice", "invite", "edit", "archive"]);
  assert.deepEqual(rowActionsFor({ ...base, portalClientId: "acme", aiLogins: ["a@acme.co"] }), ["invoice", "invite", "remove-login", "report", "edit", "archive"]);
  assert.equal(canInvite({ ...base, userId: "u" }), false);
  assert.match(removeLoginText({ ...base, portalClientId: "acme", aiLogins: ["x@y.co"] }), /AI report.*client, their invoices, AI report data and API keys stay/);
  assert.deepEqual(publicClient({ id: "c1", business_name: "A" }, { aiLogins: ["x@y.co"] }).aiLogins, ["x@y.co"]);
  assert.deepEqual(publicClient({ id: "c1", business_name: "A" }).aiLogins, []);
});

test("Clients API: remove-login keeps the row; only invited clients auto-link; nothing emails", () => {
  const id = read("pages/api/admin/clients/[id]/index.js");
  assert.match(id, /action === "remove-login" \|\| action === "revoke"/);
  assert.match(id, /purge-ai/);
  assert.doesNotMatch(id, /sendEmail|delete\(\)/);
  const logins = read("libs/clients/logins.js");
  assert.match(logins, /update\(\{ user_id: null, invited_at: null/);
  assert.doesNotMatch(logins, /deleteUser|sendEmail|from\("clients"\)\.delete/);
  assert.match(logins, /CLIENT_ROLES\.includes/);
  assert.match(read("libs/db/clients.js"), /\.not\("invited_at", "is", null\)/);
  const ui = read("components/admin/ClientsSection.jsx");
  assert.match(ui, /testid: 'row-remove-login'/);
  assert.match(ui, /data-testid="form-remove-login"/);
  assert.match(ui, /data-testid="unlinked-logins"/);
  for (const k of ["row-new-invoice", "row-report", "form-archive", "form-unarchive", "form-purge-ai", "row-invite"]) assert.ok(ui.includes(k) || ui.includes("row-${a}"), k);
});

test("Row actions: one primary button plus a ⋯ menu, destructive items last, no wrapping", () => {
  const menu = read("components/common/RowMenu.jsx");
  for (const k of ["Escape", "ArrowDown", "ArrowUp", "mousedown", "touchstart", 'aria-haspopup="menu"', "createPortal", 'role="separator"']) assert.ok(menu.includes(k), k);
  const ui = read("components/admin/ClientsSection.jsx");
  assert.doesNotMatch(ui, /flex-wrap gap-x-3 gap-y-1">\{actions/);
  const order = ["row-edit", "row-invite", "row-resend", "row-report", "divider: true", "row-remove-login", "row-archive"].map((k) => ui.indexOf(k));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(ui, /login-link[\s\S]*login-remove[\s\S]*login-cancel-invite/);
  const inv = read("components/admin/InvoicesSection.jsx");
  assert.match(inv, /<RowMenu items=\{items\}/);
  const team = read("components/admin/UsersList.jsx");
  assert.match(team, /<RowMenu/);
  assert.match(team, /<RowPrimary/);
});
