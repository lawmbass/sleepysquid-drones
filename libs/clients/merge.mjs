// Pure planner for the clients merge (spec: /specs clients-merge, Oct 26 2026).
// Same rules as supabase/migrations/20261027040000_clients_merge.sql, so the dry run predicts the migration:
//   1. Every client-role user (not admin, not @sleepysquid.com) becomes a client row (user_id set = "Has login").
//   2. Every non-example AI client (portal.clients) merges into the one client row that matches on
//      case-insensitive login email OR exact business name. 0 matches: new AI-only row. 2+ matches, or a row
//      claimed by 2+ AI clients: flagged, not merged (kept as a separate row for Lawrence to review).
//   3. Invoices re-point: user_id / ai_client_id -> client_id. One-time (email only) invoices keep recipient_email.
export const SERVICES = ["drones", "ai", "web"];
const lc = (s) => String(s || "").trim().toLowerCase();
const txt = (s) => { const t = String(s ?? "").trim(); return t || null; };
export const isStaffEmail = (e) => lc(e).endsWith("@sleepysquid.com");

export function planClientsMerge({ users = [], aiClients = [], aiClientUsers = [], invoices = [] }) {
  const flagged = [];
  const flag = (kind, detail, refs = {}) => flagged.push({ kind, detail, ...refs });
  const clients = [];
  const skipped = { admins: 0, staffEmail: 0, pilots: 0, exampleAi: 0 };

  for (const u of users) {
    const role = lc(u.role);
    if (role === "admin") { skipped.admins++; continue; }
    if (role !== "client" && role !== "user") { skipped.pilots++; continue; }
    if (isStaffEmail(u.email)) { skipped.staffEmail++; flag("staff-email-client", `${u.email} has role ${role} but a @sleepysquid.com email; not made a client`, { userId: u.id }); continue; }
    const business = txt(u.company) || txt(u.name) || lc(u.email);
    if (!txt(u.company)) flag("business-name-derived", `${u.email}: no company, business name set to "${business}"`, { userId: u.id });
    clients.push({ key: `user:${u.id}`, business_name: business, contact_name: txt(u.name), email: lc(u.email) || null, phone: txt(u.phone),
      services: ["drones"], hourly_rate: null, user_id: u.id, portal_client_id: null, archived_at: null, stripe_customer_id: u.stripe_customer_id || null, from: { user_id: u.id } });
  }

  const emailsByAi = {};
  for (const r of aiClientUsers) (emailsByAi[r.client_id] ||= []).push(lc(r.email));
  const ai = aiClients.filter((c) => { if (c.is_example) { skipped.exampleAi++; return false; } return true; });
  const userRows = clients.slice();
  const cands = new Map(ai.map((c) => {
    const em = new Set(emailsByAi[c.id] || []);
    return [c.id, userRows.filter((r) => (r.email && em.has(r.email)) || r.business_name === c.name)];
  }));
  const claims = new Map();
  for (const [id, list] of cands) for (const r of list) (claims.get(r.key) || claims.set(r.key, []).get(r.key)).push(id);

  for (const c of ai) {
    const list = cands.get(c.id);
    const emails = emailsByAi[c.id] || [];
    const aiPart = { hourly_rate: c.hourly_rate ?? null, portal_client_id: c.id, archived_at: c.deleted_at || null };
    if (list.length === 1 && claims.get(list[0].key).length === 1) {
      const r = list[0];
      Object.assign(r, aiPart, { services: [...new Set([...r.services, "ai"])], from: { ...r.from, ai_client_id: c.id } });
      if (r.business_name !== c.name) flag("name-differs", `AI client "${c.name}" merged into "${r.business_name}" by email; kept "${r.business_name}"`, { aiClientId: c.id });
      continue;
    }
    if (list.length > 1) flag("ambiguous", `AI client "${c.name}" matches ${list.length} client users (${list.map((r) => r.email).join(", ")}); kept separate`, { aiClientId: c.id });
    else if (list.length === 1) flag("ambiguous", `client user ${list[0].email} matches ${claims.get(list[0].key).length} AI clients; "${c.name}" kept separate`, { aiClientId: c.id });
    if (emails.length > 1) flag("multiple-login-emails", `AI client "${c.name}" has ${emails.length} login emails; client email set to ${emails[0]}`, { aiClientId: c.id });
    if (!emails.length) flag("no-email", `AI client "${c.name}" has no email; can't be invited or invoiced until one is added`, { aiClientId: c.id });
    clients.push({ key: `ai:${c.id}`, business_name: c.name, contact_name: null, email: emails[0] || null, phone: null, services: ["ai"], user_id: null,
      stripe_customer_id: null, ...aiPart, from: { ai_client_id: c.id } });
  }

  const seen = new Map();
  for (const r of clients) if (r.email) { if (seen.has(r.email)) { flag("duplicate-email", `${r.email} is on "${seen.get(r.email)}" and "${r.business_name}"; email must be unique, second row's email cleared`); r.email = null; } else seen.set(r.email, r.business_name); }

  const byUser = new Map(clients.filter((r) => r.user_id).map((r) => [r.user_id, r]));
  const byAi = new Map(clients.filter((r) => r.portal_client_id).map((r) => [r.portal_client_id, r]));
  const repoint = [];
  for (const inv of invoices) {
    const target = inv.user_id ? byUser.get(inv.user_id) : inv.ai_client_id ? byAi.get(inv.ai_client_id) : null;
    if (target) repoint.push({ invoiceId: inv.id, from: inv.user_id ? `user:${inv.user_id}` : `ai:${inv.ai_client_id}`, to: target.key });
    else if (inv.recipient_email && !inv.user_id && !inv.ai_client_id) repoint.push({ invoiceId: inv.id, from: `email:${lc(inv.recipient_email)}`, to: null });
    else flag("invoice-unresolved", `invoice ${inv.number || inv.id} (${inv.user_id ? "user " + inv.user_id : "ai " + inv.ai_client_id}) has no client row`, { invoiceId: inv.id });
  }

  const portal = (r) => (r.user_id ? "Has login" : "No login");
  const counts = {
    sourceClientUsers: users.filter((u) => ["client", "user"].includes(lc(u.role))).length,
    sourceAiClients: aiClients.length,
    clients: clients.length,
    merged: clients.filter((r) => r.from.user_id && r.from.ai_client_id).length,
    fromUsersOnly: clients.filter((r) => r.from.user_id && !r.from.ai_client_id).length,
    fromAiOnly: clients.filter((r) => !r.from.user_id).length,
    archived: clients.filter((r) => r.archived_at).length,
    hasLogin: clients.filter((r) => r.user_id).length,
    invoices: invoices.length,
    invoicesRepointed: repoint.filter((r) => r.to).length,
    invoicesOneTime: repoint.filter((r) => !r.to).length,
    skipped,
    flagged: flagged.length,
  };
  return { counts, clients: clients.map((r) => ({ ...r, portal: portal(r) })), invoices: repoint, flagged };
}
