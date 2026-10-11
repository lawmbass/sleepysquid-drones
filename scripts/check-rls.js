#!/usr/bin/env node

/**
 * Checks the Supabase migration keeps RLS on, and that the anon key cannot
 * read bookings or mission listings.
 *
 * Static checks always run. A live check runs when
 * NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 * If SUPABASE_SERVICE_ROLE_KEY is also set, the script inserts a probe row
 * with the service role and asserts the anon key cannot see it.
 */

const fs = require("fs");
const path = require("path");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261011120000_initial_schema.sql"
);

function fail(message) {
  console.error(`RLS check failed: ${message}`);
  process.exitCode = 1;
}

function staticChecks(sql) {
  const tables = [...sql.matchAll(/CREATE TABLE public\.(\w+)/g)].map((match) => match[1]);
  if (tables.length === 0) {
    fail("no tables found in the migration");
    return;
  }

  for (const table of tables) {
    const enabled = new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i");
    if (!enabled.test(sql)) {
      fail(`${table} does not enable row level security`);
    }
  }

  if (/USING\s*\(\s*true\s*\)/i.test(sql) || /WITH CHECK\s*\(\s*true\s*\)/i.test(sql)) {
    fail("found an always-true RLS policy");
  }

  const policyPattern = /CREATE POLICY\s+(\w+)\s+ON\s+public\.(\w+)\s+FOR\s+(\w+)(?:\s+TO\s+([^\n]+))?/gi;
  const policies = [...sql.matchAll(policyPattern)];
  const anonSelect = policies.filter((match) => {
    const command = match[3].toUpperCase();
    const roles = (match[4] || "").toLowerCase();
    return (command === "SELECT" || command === "ALL") && roles.includes("anon");
  });

  for (const match of anonSelect) {
    const table = match[2];
    if (table === "bookings" || table === "mission_listings" || table === "users" || table === "invitations") {
      fail(`anon can ${match[3]} ${table} via policy ${match[1]}`);
    }
  }

  const bookingsInsert = policies.some((match) => {
    return match[2] === "bookings" && match[3].toUpperCase() === "INSERT" && (match[4] || "").toLowerCase().includes("anon");
  });
  if (!bookingsInsert) {
    fail("bookings is missing the anon customer-insert policy");
  }

  if (!sql.includes("mission_listings_admin_select")) {
    fail("mission_listings is missing the admin read policy");
  }

  if (!sql.includes("CONSTRAINT mission_listings_source_external_unique")) {
    fail("mission_listings is missing the source + external id unique key");
  }

  if (process.exitCode) return;
  console.log(`Static RLS checks passed for ${tables.length} tables: ${tables.join(", ")}`);
}

async function liveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.log("Live RLS check skipped. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to query the project.");
    return;
  }

  async function selectAs(table, key) {
    const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=5`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }

  for (const table of ["bookings", "mission_listings"]) {
    const result = await selectAs(table, anonKey);
    if (result.status === 200 && Array.isArray(result.body) && result.body.length > 0) {
      fail(`anon key returned ${result.body.length} ${table} row(s)`);
      return;
    }
    if (result.status === 200 && Array.isArray(result.body)) {
      console.log(`Anon select on ${table} returned no rows.`);
    } else {
      console.log(`Anon select on ${table} was rejected (${result.status}).`);
    }
  }

  if (!serviceKey) {
    console.log("Service role key not set, so the live check could not plant a hidden row.");
    return;
  }

  const probeDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const bookingResponse = await fetch(`${url}/rest/v1/bookings`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      source: "customer",
      service: "inspection",
      date: probeDate,
      location: "RLS probe",
      name: "RLS Probe",
      email: "rls-probe@example.com",
      phone: "5555555555",
      status: "pending",
    }),
  });
  const booking = await bookingResponse.json().catch(() => null);
  if (!bookingResponse.ok) {
    fail(`service role could not insert a bookings probe (${bookingResponse.status})`);
    return;
  }
  const bookingId = Array.isArray(booking) ? booking[0]?.id : booking?.id;

  const listingResponse = await fetch(`${url}/rest/v1/mission_listings`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      source: "zeitview",
      external_mission_id: `rls-probe-${Date.now()}`,
      title: "RLS probe",
      status: "seen",
    }),
  });
  const listing = await listingResponse.json().catch(() => null);
  const listingId = Array.isArray(listing) ? listing[0]?.id : listing?.id;

  try {
    if (bookingId) {
      const seen = await fetch(`${url}/rest/v1/bookings?id=eq.${bookingId}&select=id`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const rows = await seen.json().catch(() => null);
      if (seen.ok && Array.isArray(rows) && rows.length > 0) {
        fail("anon key can read a bookings row written by the service role");
      } else {
        console.log("Anon key cannot read the bookings probe row.");
      }
    }
    if (listingResponse.ok && listingId) {
      const seen = await fetch(`${url}/rest/v1/mission_listings?id=eq.${listingId}&select=id`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const rows = await seen.json().catch(() => null);
      if (seen.ok && Array.isArray(rows) && rows.length > 0) {
        fail("anon key can read a mission_listings row written by the service role");
      } else {
        console.log("Anon key cannot read the mission_listings probe row.");
      }
    } else if (!listingResponse.ok) {
      fail(`service role could not insert a mission_listings probe (${listingResponse.status}). Apply the migration first.`);
    }
  } finally {
    const cleanupHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };
    if (bookingId) {
      await fetch(`${url}/rest/v1/bookings?id=eq.${bookingId}`, { method: "DELETE", headers: cleanupHeaders });
    }
    if (listingId) {
      await fetch(`${url}/rest/v1/mission_listings?id=eq.${listingId}`, { method: "DELETE", headers: cleanupHeaders });
    }
  }
}

async function main() {
  if (!fs.existsSync(migrationPath)) {
    fail(`missing ${migrationPath}`);
    return;
  }
  const sql = fs.readFileSync(migrationPath, "utf8");
  staticChecks(sql);
  if (process.exitCode) return;
  await liveChecks();
}

main().catch((error) => {
  fail(error.message);
});
