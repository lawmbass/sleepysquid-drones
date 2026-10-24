import assert from "node:assert/strict";
import test from "node:test";
import { classifyAirspace } from "./airspaceData.mjs";

function base(overrides = {}) {
  return {
    frz: { ok: true, insideFrz: false, insideSfra: false },
    facilityMap: { ok: true, ceilingFt: 400, airspaces: [], controlled: false, airport: null },
    classAirspace: { ok: true, surfaceClasses: [], shelves: [] },
    p56: { ok: true, inside: false },
    nps: { ok: true, inside: false, units: [] },
    ...overrides,
  };
}

test("DC FRZ is not realistic and asks for the waiver", () => {
  const result = classifyAirspace(base({ frz: { ok: true, insideFrz: true, insideSfra: true } }));
  assert.equal(result.verdict, "Not realistic");
  assert.match(result.summary, /FAA\/TSA special waiver/);
  assert.match(result.authorization, /rarely approved/);
});

test("SFRA outside the FRZ with no grid stays realistic", () => {
  const result = classifyAirspace(
    base({
      frz: { ok: true, insideFrz: false, insideSfra: true },
      facilityMap: { ok: true, ceilingFt: null, airspaces: [], controlled: false, airport: null },
      classAirspace: { ok: true, surfaceClasses: [], shelves: [{ class: "B", floorFt: 2500, name: "WASHINGTON-TRI AREA CLASS B" }] },
    })
  );
  assert.equal(result.verdict, "Realistic");
  assert.match(result.sfraNote, /normal Part 107/);
  assert.match(result.shelfNote, /2,500 ft MSL/);
  assert.equal(result.ceilingText, "No facility-map cell at this point");
});

test("a ceiling under 400 needs LAANC", () => {
  const result = classifyAirspace(
    base({ facilityMap: { ok: true, ceilingFt: 100, airspaces: ["B"], controlled: true, airport: "BWI" } })
  );
  assert.equal(result.verdict, "Needs LAANC");
  assert.match(result.summary, /100 ft/);
  assert.match(result.authorization, /DroneZone/);
});

test("a 0 ft grid is DroneZone only", () => {
  const result = classifyAirspace(
    base({ facilityMap: { ok: true, ceilingFt: 0, airspaces: ["B"], controlled: true, airport: "BWI" } })
  );
  assert.equal(result.verdict, "Not realistic");
  assert.match(result.summary, /DroneZone only/);
  assert.match(result.authorization, /LAANC cannot approve/);
});

test("controlled airspace on a 400 ft grid needs LAANC", () => {
  const result = classifyAirspace(
    base({ facilityMap: { ok: true, ceilingFt: 400, airspaces: ["B"], controlled: true, airport: "DCA" } })
  );
  assert.equal(result.verdict, "Needs LAANC");
});

test("a failed FRZ query is not guessed as realistic", () => {
  const result = classifyAirspace(base({ frz: { ok: false } }));
  assert.equal(result.verdict, "Couldn't verify");
  assert.match(result.summary, /will not guess/);
});

test("P-56 and NPS land are no-takeoff", () => {
  const p56 = classifyAirspace(base({ p56: { ok: true, inside: true } }));
  const nps = classifyAirspace(base({ nps: { ok: true, inside: true, units: ["Lincoln Memorial"] } }));
  assert.equal(p56.verdict, "Not realistic");
  assert.match(p56.authorization, /P-56/);
  assert.equal(nps.verdict, "Not realistic");
  assert.match(nps.authorization, /Lincoln Memorial/);
});

test("the checklist keeps only the items that apply, plus the basics", () => {
  const ids = (result) => result.checklist.map((entry) => entry.id);
  const frz = classifyAirspace(base({ frz: { ok: true, insideFrz: true, insideSfra: true } }));
  assert.deepEqual(ids(frz), ["frz", "part107", "insurance", "b4ufly"]);
  assert.match(frz.checklist[0].why, /rarely approved/);
  assert.ok(frz.checklist[0].href.startsWith("https://"));

  const clear = classifyAirspace(base());
  assert.deepEqual(ids(clear), ["part107", "insurance", "b4ufly"]);
  const insurance = clear.checklist.find((entry) => entry.id === "insurance");
  assert.match(insurance.label, /\$1M liability coverage/);
  assert.doesNotMatch(`${insurance.label} ${insurance.why}`, /skywatch|fully insured|\bhull\b|bonded/i);

  const laanc = classifyAirspace(
    base({ facilityMap: { ok: true, ceilingFt: 100, airspaces: ["B"], controlled: true, airport: "BWI" } })
  );
  assert.equal(laanc.checklist[0].id, "laanc");
  assert.match(laanc.checklist[0].label, /up to 100 ft/);

  const zero = classifyAirspace(
    base({ facilityMap: { ok: true, ceilingFt: 0, airspaces: ["B"], controlled: true, airport: "BWI" } })
  );
  assert.ok(ids(zero).includes("dronezone"));
  assert.equal(ids(zero).includes("laanc"), false);

  const nps = classifyAirspace(base({ nps: { ok: true, inside: true, units: ["Lincoln Memorial"] } }));
  assert.match(nps.checklist.find((entry) => entry.id === "nps").why, /Lincoln Memorial/);

  const sfra = classifyAirspace(
    base({
      frz: { ok: true, insideFrz: false, insideSfra: true },
      facilityMap: { ok: true, ceilingFt: null, airspaces: [], controlled: false, airport: null },
    })
  );
  assert.deepEqual(ids(sfra), ["sfra", "part107", "insurance", "b4ufly"]);

  const frzSurface = classifyAirspace(
    base({
      frz: { ok: true, insideFrz: true, insideSfra: true },
      classAirspace: { ok: true, surfaceClasses: ["B"], shelves: [] },
    })
  );
  assert.equal(ids(frzSurface).includes("laanc"), false);

  const unknown = classifyAirspace(base({ frz: { ok: false } }));
  assert.deepEqual(ids(unknown), ["part107", "insurance", "b4ufly"]);
});

test("surface Class B with no grid needs LAANC and does not invent a ceiling", () => {
  const result = classifyAirspace(
    base({
      facilityMap: { ok: true, ceilingFt: null, airspaces: [], controlled: false, airport: null },
      classAirspace: { ok: true, surfaceClasses: ["B"], shelves: [] },
    })
  );
  assert.equal(result.verdict, "Needs LAANC");
  assert.equal(result.ceilingText, "No facility-map cell at this point");
});
