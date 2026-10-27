#!/usr/bin/env node
// READ-ONLY dry run of the clients merge against a running app (default: prod).
// Signs in as the check account and only sends GET requests to existing admin endpoints; nothing is written.
// Usage: node scripts/clients-merge-dry-run.mjs [base_url] [--json]
// Creds: DRONES_CHECK_EMAIL / DRONES_CHECK_PASSWORD in env (e.g. `set -a; . /workspace/.secrets/drones-check.env`). Never printed.
import { planClientsMerge } from "../libs/clients/merge.mjs";

const B = (process.argv.slice(2).find((a) => a.startsWith("http")) || "https://drones.sleepysquid.com").replace(/\/$/, "");
const asJson = process.argv.includes("--json");
const { DRONES_CHECK_EMAIL: email, DRONES_CHECK_PASSWORD: password } = process.env;
if (!email || !password) { console.error("Set DRONES_CHECK_EMAIL and DRONES_CHECK_PASSWORD"); process.exit(2); }

const jar = new Map();
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
async function http(path, { method = "GET", form } = {}) {
  // The only non-GET request is the NextAuth sign-in POST; the data endpoints are GET only.
  if (method !== "GET" && path !== "/api/auth/callback/credentials") throw new Error("dry run is read-only");
  const r = await fetch(B + path, { method, redirect: "manual", headers: { cookie: cookie(), ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) }, body: form ? new URLSearchParams(form) : undefined });
  for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
  return r;
}
async function get(path) {
  const r = await http(path);
  if (r.status !== 200) throw new Error(`GET ${path.split("?")[0]} -> ${r.status}`);
  return r.json();
}

const { csrfToken } = await (await http("/api/auth/csrf")).json();
await http("/api/auth/callback/credentials", { method: "POST", form: { csrfToken, email, password, json: "true" } });
const session = await get("/api/auth/session");
if (!session?.user?.isAdmin) throw new Error("check account is not signed in as admin");

const users = (await get("/api/admin/users?limit=1000")).data.users.map((u) => ({ id: u.id || u._id, role: u.role, email: u.email, name: u.name, company: u.company, phone: u.phone }));
const live = await get("/api/user/ai-portal-admin");
const deleted = await get("/api/user/ai-portal-admin?deleted=1");
const portal = [...live.clients, ...deleted.clients];
const aiClients = portal.map((c) => ({ id: c.id, name: c.name, hourly_rate: c.hourly_rate, is_example: c.is_example, deleted_at: c.deleted_at }));
const aiClientUsers = portal.flatMap((c) => (c.emails || []).map((e) => ({ client_id: c.id, email: e })));
const inv = (await get("/api/admin/invoicing/invoices")).data;
const invoices = (inv.invoices || []).map((i) => ({ id: i.id, number: i.number, user_id: i.user_id ?? i.userId ?? (i.client?.kind === "user" ? i.client.id : null), ai_client_id: i.ai_client_id ?? (i.client?.kind === "ai" ? String(i.client.id).replace(/^ai:/, "") : null), recipient_email: i.recipient_email ?? (i.client?.kind === "email" ? i.client.email : null) }));

const plan = planClientsMerge({ users, aiClients, aiClientUsers, invoices });
if (asJson) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
console.log(`Clients merge DRY RUN against ${B} (read-only, ${new Date().toISOString()})`);
console.log("Counts:", JSON.stringify(plan.counts, null, 2));
console.log("\nResulting clients:");
for (const c of plan.clients) console.log(`  - ${c.business_name} | ${c.email || "(no email)"} | ${c.services.join(",")}${c.hourly_rate != null ? ` $${c.hourly_rate}/hr` : ""} | ${c.portal}${c.archived_at ? " | ARCHIVED" : ""} | from ${Object.entries(c.from).map(([k, v]) => `${k}=${v}`).join(" + ")}`);
console.log(`\nFlagged (${plan.flagged.length}):`);
for (const f of plan.flagged) console.log(`  - [${f.kind}] ${f.detail}`);
if (!plan.flagged.length) console.log("  (none)");
console.log("\nNote: stripe_customer_id isn't exposed by the admin API, so the dry run can't show it; the migration copies it from users.");
