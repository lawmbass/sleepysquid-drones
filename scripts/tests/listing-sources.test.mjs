import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceLabel, sourceCounts, isSmsListing, listingMessageText, messagePreview,
  isSparseListing, missionPageUrl, receivedAt,
} from "../../libs/listingSources.js";
import { deriveMissionType, resolveListingMissionType } from "../../libs/missionType.js";

test("source labels spell Zeitview and handle unknowns", () => {
  assert.equal(sourceLabel("zeitview"), "Zeitview");
  assert.equal(sourceLabel("FLYGUYS"), "FlyGuys");
  assert.equal(sourceLabel("droners"), "Droners");
  assert.equal(sourceLabel(""), "Unknown");
  assert.equal(sourceLabel("dronebase"), "Dronebase");
});

test("source counts sum into All", () => {
  const counts = sourceCounts({ zeitview: 5, flyguys: 2 });
  assert.equal(counts[""], 7);
  assert.equal(counts.zeitview, 5);
  assert.equal(counts.droners, 0);
});

test("FlyGuys SMS row is sparse and shows its text", () => {
  const sms = { source: "flyguys", externalMissionId: "sms:SM123", rawEmailText: "  New job in Austin, TX  roof photos ", firstSeenAt: "2026-10-25T14:11:00Z" };
  assert.equal(isSmsListing(sms), true);
  assert.equal(isSparseListing(sms), true);
  assert.equal(listingMessageText(sms), "New job in Austin, TX  roof photos");
  assert.equal(messagePreview(sms, 10), "New job i…");
  assert.equal(receivedAt(sms), "2026-10-25T14:11:00Z");
  assert.equal(receivedAt({ ...sms, rawDetail: { twilio: { receivedAt: "x" } } }), "x");
});

test("structured Zeitview row is not sparse", () => {
  assert.equal(isSparseListing({ payout: 90, address: "1 Main St" }), false);
});

test("Zeitview links only on Zeitview rows", () => {
  const url = "https://app.zeitview.com/missions/123";
  assert.equal(missionPageUrl({ source: "zeitview", rawDetail: { url } }), url);
  assert.equal(missionPageUrl({ source: "flyguys", rawDetail: { url } }), null);
  assert.equal(missionPageUrl({ source: "flyguys", rawDetail: { parsed: { missionLink: "https://flyguys.com/m/1" } } }), "https://flyguys.com/m/1");
  assert.equal(missionPageUrl({ source: "zeitview", rawDetail: { url: "javascript:alert(1)" } }), null);
});

test("mission type: explicit wins, else derived", () => {
  assert.equal(deriveMissionType({ missionType: "Real Estate" }), "Real Estate");
  assert.equal(deriveMissionType({ rawDetail: { mission_type: "Telecom" } }), "Telecom");
  assert.equal(deriveMissionType({ rawEmailText: "FlyGuys\nMission Type: Roof Inspection\nPay $120" }), "Roof Inspection");
  assert.equal(deriveMissionType({ title: "Residential Real Estate - 12 Oak St" }), "Real Estate");
  assert.equal(deriveMissionType({ flightPlan: [{ shot_type: "grid/mapping" }] }), "Mapping / Survey");
  assert.equal(deriveMissionType({ title: "sms:SM1" }), null);
});

test("real Zeitview scope wins, then inference without boilerplate", () => {
  const camera = "Check exposure and set your white balance depending on intensity of light. Video: 4K, 30fps";
  assert.deepEqual(resolveListingMissionType({ source: "zeitview", raw_detail: { parsed: { special_instructions: ["Partner Name: Truplace", "Scope: Aerial images"] } } }), { type: "Aerial Images", source: "zeitview" });
  assert.deepEqual(resolveListingMissionType({ source: "zeitview", raw_detail: { parsed: { special_instructions: ["Partner Name: Truplace"] } } }), { type: "Real Estate", source: "inferred" });
  assert.deepEqual(resolveListingMissionType({ source: "zeitview", deliverables: [camera], raw_email_text: "A Client Mission is available near you. roof video" }), { type: null, source: null });
  assert.deepEqual(resolveListingMissionType({ source: "zeitview", raw_detail: { parsed: { partner: "DroneDeploy", acreage: 34.57 } } }), { type: "Mapping / Survey", source: "inferred" });
  assert.deepEqual(resolveListingMissionType({ source: "flyguys", raw_email_text: "Job type: roof inspection $150" }), { type: "Roof Inspection", source: "flyguys" });
});
