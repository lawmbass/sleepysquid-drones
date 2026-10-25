#!/usr/bin/env node
// Fill mission_listings.mission_type from the text the bot already stored.
// Dry run by default: prints how many rows per source would get a type.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-mission-type.mjs [--apply]
// Do not run --apply against production without Lawrence's yes.
import { deriveMissionType } from "../libs/missionType.js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const cols = "id,source,mission_type,title,client_name,deliverables,required_equipment,flight_plan,raw_email_text,raw_detail";

const rows = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${url}/rest/v1/mission_listings?select=${cols}&mission_type=is.null&order=id`, {
    headers: { ...headers, Range: `${from}-${from + 999}` },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  const page = await res.json();
  rows.push(...page);
  if (page.length < 1000) break;
}

const summary = {};
const updates = [];
for (const row of rows) {
  const type = deriveMissionType(row);
  const s = (summary[row.source || "unknown"] ??= { untyped: 0, wouldGetType: 0, types: {} });
  s.untyped += 1;
  if (type) {
    s.wouldGetType += 1;
    s.types[type] = (s.types[type] || 0) + 1;
    updates.push({ id: row.id, type });
  }
}
console.log(JSON.stringify({ apply, untypedRows: rows.length, wouldUpdate: updates.length, bySource: summary }, null, 2));

if (apply) {
  for (const { id, type } of updates) {
    const res = await fetch(`${url}/rest/v1/mission_listings?id=eq.${id}&mission_type=is.null`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ mission_type: type }),
    });
    if (!res.ok) throw new Error(`Update ${id} failed: ${res.status}`);
  }
  console.log(`Updated ${updates.length} rows.`);
}
