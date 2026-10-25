import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression: #107 renamed the import but listingAggregates still called
// deriveMissionType, so /api/admin/listings threw ReferenceError in prod.
test("libs/db/listings.js imports every missionType helper it calls", () => {
  const src = readFileSync(new URL("../../libs/db/listings.js", import.meta.url), "utf8");
  const imported = new Set((src.match(/import \{([^}]+)\} from "@\/libs\/missionType"/)?.[1] || "").split(",").map((s) => s.trim()));
  for (const name of ["deriveMissionType", "resolveListingMissionType"]) {
    if (new RegExp(`\\b${name}\\(`).test(src)) assert.ok(imported.has(name), `${name} is used but not imported`);
  }
});
