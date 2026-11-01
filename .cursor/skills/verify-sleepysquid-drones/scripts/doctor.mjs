#!/usr/bin/env node
/**
 * Read-only check that the local Next process is the one launch.sh started
 * and that it is not attached to production Supabase, email, or Stripe.
 *
 * Usage (from the repo root, after launch.sh):
 *   node .cursor/skills/verify-sleepysquid-drones/scripts/doctor.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STATE = process.env.VERIFY_STATE || "/tmp/verify-sleepysquid-drones";
const evidenceDir = path.join(STATE, "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function repoRoot() {
  let dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../..");
  while (!fs.existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("package.json not found");
    dir = parent;
  }
  return dir;
}

function readEnviron(pid) {
  const raw = fs.readFileSync(`/proc/${pid}/environ`);
  const env = {};
  for (const entry of raw.toString("utf8").split("\0")) {
    if (!entry) continue;
    const index = entry.indexOf("=");
    if (index === -1) continue;
    env[entry.slice(0, index)] = entry.slice(index + 1);
  }
  return env;
}

const root = repoRoot();
const pidFile = path.join(STATE, "pid");
const baseFile = path.join(STATE, "base-url");
if (!fs.existsSync(pidFile) || !fs.existsSync(baseFile)) {
  fail("launch.sh has not recorded a pid and base URL");
}

let base = "";
let env = {};
if (fs.existsSync(baseFile)) base = fs.readFileSync(baseFile, "utf8").trim();
if (fs.existsSync(pidFile)) {
  const pid = fs.readFileSync(pidFile, "utf8").trim();
  try {
    process.kill(Number(pid), 0);
    env = readEnviron(pid);
    notes.push(`pid ${pid} is alive`);
  } catch {
    fail(`pid ${pid} is not running`);
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) {
  fail(`NEXT_PUBLIC_SUPABASE_URL must be a loopback http URL, got ${url || "(unset)"}`);
}
if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "local-verify-anon") {
  fail("anon key is not the local-verify-anon placeholder");
}
if (env.SUPABASE_SERVICE_ROLE_KEY !== "local-verify-service") {
  fail("service role key is not the local-verify-service placeholder");
}
if (env.NEXTAUTH_URL !== base) {
  fail(`NEXTAUTH_URL ${env.NEXTAUTH_URL || "(unset)"} does not match ${base}`);
}
if (env.ADMIN_EMAILS !== "verify-admin@example.test") {
  fail("ADMIN_EMAILS is not the fixture address verify-admin@example.test");
}

const banned = ["etbesmtdsjlmadaexvrv", "supabase.co", "sk_live_", "rk_live_", "RESEND_API_KEY=", "MAILGUN_API_KEY="];
const blob = Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n");
for (const token of banned) {
  if (blob.includes(token)) fail(`server environment contains ${token}`);
}
for (const key of ["RESEND_API_KEY", "MAILGUN_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_INVOICING_SECRET_KEY", "SMTP_PASSWORD", "GOOGLE_MAPS_API_KEY", "RECAPTCHA_SECRET_KEY"]) {
  if (env[key]) fail(`${key} is set on the server process`);
}

async function get(pathname, { redirect = "follow" } = {}) {
  const response = await fetch(base + pathname, { redirect });
  const text = await response.text();
  return { status: response.status, location: response.headers.get("location"), text };
}

if (base) {
  const home = await get("/");
  if (home.status !== 200) fail(`GET / returned ${home.status}`);
  for (const needle of [
    "Elevate Your Perspective with SleepySquid Drones",
    "Listing Photos",
    "Listing Photos + Video",
    "Event Aerials",
    "Mapping &amp; 3D",
    "Book Your Drone Service",
    "id=\"service\"",
    "id=\"package\"",
  ]) {
    if (!home.text.includes(needle)) fail(`homepage is missing ${needle}`);
  }
  notes.push("GET / 200 with pricing and booking form");

  const health = await get("/api/health/database");
  let healthBody = {};
  try { healthBody = JSON.parse(health.text); } catch { fail("health body is not JSON"); }
  if (health.status !== 503) fail(`GET /api/health/database returned ${health.status}, expected 503 while the local URL is closed`);
  if (healthBody.database === "connected") fail("database reports connected");
  if (healthBody.status === "healthy") fail("health status is healthy");
  notes.push(`health ${health.status} database=${healthBody.database || "?"} (projectRef in the JSON is a hardcoded constant and is not a live connection)`);
  fs.writeFileSync(path.join(evidenceDir, "health.json"), JSON.stringify({ status: health.status, body: healthBody }, null, 2));

  const promo = await get("/api/promo/active");
  if (promo.status === 200) fail("GET /api/promo/active returned 200; the empty local instance should fail closed");
  notes.push(`GET /api/promo/active ${promo.status}`);

  const dashboard = await get("/dashboard", { redirect: "manual" });
  let loginRedirect = null;
  try { loginRedirect = dashboard.location ? new URL(dashboard.location) : null; } catch { loginRedirect = null; }
  if (![301, 302, 303, 307, 308].includes(dashboard.status) || !loginRedirect) {
    fail(`GET /dashboard returned ${dashboard.status} location ${dashboard.location}`);
  } else if (!["127.0.0.1", "localhost"].includes(loginRedirect.hostname) || !loginRedirect.pathname.startsWith("/login")) {
    fail(`GET /dashboard redirected off the local login page to ${dashboard.location}`);
  } else {
    notes.push(`GET /dashboard ${dashboard.status} -> ${dashboard.location}`);
  }

  const bookings = await get("/api/admin/bookings");
  if (bookings.status !== 401) fail(`GET /api/admin/bookings returned ${bookings.status}, expected 401`);
  else notes.push("GET /api/admin/bookings 401");

  const listings = await get("/api/admin/listings");
  if (listings.status !== 401) fail(`GET /api/admin/listings returned ${listings.status}, expected 401`);
  else notes.push("GET /api/admin/listings 401");

  const preview = await get("/preview/connected-sources?state=green&theme=light");
  if (preview.status !== 200) fail(`preview connected sources returned ${preview.status}`);
  if (!preview.text.includes("Zeitview") || !preview.text.includes("FlyGuys")) {
    fail("connected-sources preview is missing Zeitview or FlyGuys");
  } else notes.push("GET /preview/connected-sources 200 with fixture sources");

  const rules = await get("/preview/bot-rules");
  if (rules.status !== 200) fail(`preview bot-rules returned ${rules.status}`);
  else if (!rules.text.includes("Save changes") && !rules.text.includes("Bot rules")) {
    fail("bot-rules preview did not render the rules section");
  } else notes.push("GET /preview/bot-rules 200");

  const login = await get("/login");
  if (login.status !== 200) fail(`GET /login returned ${login.status}`);
  else if (!login.text.includes("Loading")) fail("GET /login SSR did not include the session loading shell");
  else notes.push("GET /login 200. First HTML is the session loading shell; #email and #password render after useSession resolves");
}

function runNode(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  return result;
}

const rls = spawnSync(process.execPath, ["scripts/check-rls.js"], {
  cwd: root,
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
  },
  encoding: "utf8",
});
if (rls.status !== 0) {
  fail(`static RLS check failed: ${(rls.stderr || rls.stdout || "").slice(0, 400)}`);
} else if (!/Static RLS checks passed/.test(rls.stdout)) {
  fail("static RLS check did not report a pass");
} else if (!/Live RLS check skipped/.test(rls.stdout)) {
  fail("RLS check did not skip the live probe");
} else if (/probe row|could not insert|Anon select/.test(rls.stdout)) {
  fail("RLS check talked to a database");
} else {
  notes.push(rls.stdout.trim().split("\n").find((line) => line.startsWith("Static RLS")) || "static RLS passed");
}

const copy = runNode(["scripts/check-public-copy.mjs"]);
if (copy.status !== 0) fail(`check-public-copy failed: ${(copy.stderr || copy.stdout || "").slice(0, 400)}`);
else notes.push("scripts/check-public-copy.mjs passed");

const report = {
  ok: failures.length === 0,
  base,
  notes,
  failures,
};
fs.writeFileSync(path.join(evidenceDir, "doctor.json"), JSON.stringify(report, null, 2));
for (const line of notes) console.log(`ok ${line}`);
for (const line of failures) console.error(`fail ${line}`);
console.log(report.ok ? "doctor: pass" : "doctor: fail");
process.exit(report.ok ? 0 : 1);
