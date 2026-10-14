/**
 * Internal quoting check for one geocoded point.
 * Geometry comes from the FAA and NPS services below. A failed service
 * stays "couldn't verify"; this module does not fall back to a radius.
 */

const FAA_ORG = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services";
const NPS_BOUNDARY =
  "https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2";

export const SOURCES = {
  frz: {
    id: "frz",
    name: "FAA airspace boundaries (DC FRZ and DC SFRA)",
    url: `${FAA_ORG}/Boundary_Airspace/FeatureServer/0`,
    limit:
      "Official FAA AIS polygons. The DC FRZ sector is the irregular 13–15 nautical mile boundary in 14 CFR 93.335, and the DC SFRA sector is the 30-mile area around the DCA VOR that contains the FRZ. This check does not approximate either one with a radius.",
  },
  facilityMap: {
    id: "facilityMap",
    name: "FAA UAS Facility Map",
    url: `${FAA_ORG}/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0`,
    limit:
      "Grid cells, not a smooth ceiling. Overlapping cells use the lowest ceiling. No cell means the map does not publish a ceiling there (the DC FRZ is often uncovered). A missing cell is not treated as 400 ft. A 0 ft cell is FAA DroneZone only.",
  },
  classAirspace: {
    id: "classAirspace",
    name: "FAA Class Airspace",
    url: `${FAA_ORG}/Class_Airspace/FeatureServer/0`,
    limit:
      "Surface control is a Class B, C, D, or E floor of 0 ft. Higher shelves are reported in feet MSL and are not treated as controlled airspace for a flight under 400 ft AGL. Class A and Mode C veils are ignored.",
  },
  p56: {
    id: "p56",
    name: "FAA Special Use Airspace (P-56)",
    url: `${FAA_ORG}/Special_Use_Airspace/FeatureServer/0`,
    limit:
      "Both prohibited subareas are named P-56. The layer does not label them A and B.",
  },
  nps: {
    id: "nps",
    name: "NPS legislated unit boundaries",
    url: NPS_BOUNDARY,
    limit:
      "Legislated unit boundary, not fee ownership and not survey grade. NPS land outside the boundary, and non-federal inholdings inside it, are not distinguished.",
  },
};

export const RULE_REFERENCE = {
  name: "14 CFR 93.335 (DC FRZ and DC SFRA)",
  url: "https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-93/subpart-V/section-93.335",
};

export const DISCLAIMER =
  "Confirm with B4UFLY or a LAANC app before flying. This is a quoting aid, not an FAA authorization.";

const CONTROLLED = new Set(["B", "C", "D", "E"]);

export function classifyAirspace(input) {
  const frz = input.frz;
  const facility = input.facilityMap;
  const airspace = input.classAirspace;
  const p56 = input.p56;
  const nps = input.nps;

  const failures = [];
  if (!frz.ok) failures.push(SOURCES.frz.name);
  if (!facility.ok) failures.push(SOURCES.facilityMap.name);
  if (!airspace.ok) failures.push(SOURCES.classAirspace.name);
  if (!p56.ok) failures.push(SOURCES.p56.name);
  if (!nps.ok) failures.push(SOURCES.nps.name);

  const insideFrz = Boolean(frz.ok && frz.insideFrz);
  const insideSfra = Boolean(frz.ok && frz.insideSfra && !insideFrz);
  const insideP56 = Boolean(p56.ok && p56.inside);
  const insideNps = Boolean(nps.ok && nps.inside);
  const zeroGrid = Boolean(facility.ok && facility.ceilingFt === 0);
  const gridControlled = Boolean(facility.ok && facility.controlled);
  const surfaceControlled = Boolean(airspace.ok && airspace.surfaceClasses.length > 0);
  const lowCeiling = Boolean(
    facility.ok && facility.ceilingFt != null && facility.ceilingFt > 0 && facility.ceilingFt < 400
  );

  const blocks = [];
  if (insideFrz) {
    blocks.push({
      id: "frz",
      authorization:
        "Before quoting: an FAA/TSA special waiver. Those are rarely approved for real estate or promo flights.",
    });
  }
  if (insideP56) {
    blocks.push({
      id: "p56",
      authorization:
        "Before quoting: nothing routine. The point is inside P-56 prohibited airspace, which is a no-takeoff zone.",
    });
  }
  if (insideNps) {
    const names = nps.units.length ? nps.units.join(", ") : "a National Park Service unit";
    blocks.push({
      id: "nps",
      authorization: `Before quoting: National Park Service permission. The point is inside ${names}, which is a no-takeoff zone for a routine job.`,
    });
  }
  if (zeroGrid) {
    blocks.push({
      id: "zero",
      authorization:
        "Before quoting: an FAA DroneZone authorization. The facility-map grid is 0 ft, so LAANC cannot approve it.",
    });
  }

  let verdict = "Realistic";
  if (blocks.length) {
    verdict = "Not realistic";
  } else if (failures.length) {
    verdict = "Couldn't verify";
  } else if (lowCeiling || gridControlled || surfaceControlled) {
    verdict = "Needs LAANC";
  }

  const summary = summaryFor({
    verdict,
    insideFrz,
    insideP56,
    insideNps,
    failures,
    facility,
  });

  const authorization = authorizationFor({
    verdict,
    blocks,
    failures,
    insideSfra,
    facility,
    airspace,
    lowCeiling,
    gridControlled,
    surfaceControlled,
  });

  const checklist = buildChecklist({
    insideFrz,
    insideSfra,
    insideP56,
    insideNps,
    zeroGrid,
    lowCeiling,
    gridControlled,
    surfaceControlled,
    facility,
    nps,
  });

  return {
    verdict,
    summary,
    authorization,
    ceilingText: ceilingText(facility),
    ceilingFt: facility.ok ? facility.ceilingFt : null,
    insideFrz,
    insideSfra,
    insideP56,
    insideNps,
    sfraNote: insideSfra
      ? "Inside the DC SFRA, outside the FRZ: normal Part 107 rules, plus the SFRA notes. This is not the FRZ waiver."
      : null,
    shelfNote: shelfNote(airspace),
    failures,
    checklist,
  };
}

const ITEM_LINKS = {
  laanc: ["https://www.faa.gov/uas/getting_started/laanc", "FAA LAANC"],
  dronezone: ["https://faadronezone.faa.gov/", "FAA DroneZone"],
  frz: ["https://www.faa.gov/uas/resources/community_engagement/no_drone_zone/dc", "FAA DC Flight Restricted Zone"],
  nps: ["https://www.nps.gov/articles/unmanned-aircraft-in-the-national-parks.htm", "NPS unmanned aircraft policy"],
  p56: ["https://www.faa.gov/uas/getting_started/where_can_i_fly/airspace_restrictions", "FAA airspace restrictions"],
  sfra: ["https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-93/subpart-V/section-93.335", "14 CFR 93.335"],
  part107: ["https://www.faa.gov/uas/commercial_operators/become_a_drone_pilot", "FAA Part 107 certificate"],
  insurance: ["https://www.faa.gov/uas/commercial_operators", "FAA commercial operations"],
  b4ufly: ["https://www.faa.gov/uas/getting_started/b4ufly", "B4UFLY"],
};

function item(id, label, why) {
  const [href, linkLabel] = ITEM_LINKS[id];
  return { id, label, why, href, linkLabel };
}

export function alwaysOnChecklist() {
  return [
    item(
      "part107",
      "Part 107 certificate current",
      "The remote pilot certificate has to be current before this flight is quoted."
    ),
    item(
      "insurance",
      "Insurance check",
      "Confirm the company policy covers this job. The certificate does not replace that check."
    ),
    item(
      "b4ufly",
      "B4UFLY or LAANC app confirmation",
      "Check again the day of the flight. Airspace and notices can change after this quote."
    ),
  ];
}

function buildChecklist({
  insideFrz,
  insideSfra,
  insideP56,
  insideNps,
  zeroGrid,
  lowCeiling,
  gridControlled,
  surfaceControlled,
  facility,
  nps,
}) {
  const items = [];
  const noLaunch = insideFrz || insideP56 || insideNps;
  if (insideFrz) {
    items.push(item(
      "frz",
      "Special FAA/TSA waiver (FRZ)",
      "The point is inside the DC Flight Restricted Zone. These waivers are rarely approved for real estate or promo flights."
    ));
  }
  if (insideP56) {
    items.push(item(
      "p56",
      "No takeoff — P-56",
      "The point is inside P-56 prohibited airspace. There is no routine authorization to launch here."
    ));
  }
  if (insideNps) {
    const names = nps.units?.length ? nps.units.join(", ") : "National Park Service land";
    items.push(item(
      "nps",
      "NPS permission",
      `No takeoff on ${names} without National Park Service permission.`
    ));
  }
  if (zeroGrid && !insideFrz) {
    items.push(item(
      "dronezone",
      "FAA DroneZone authorization",
      "The facility-map grid is 0 ft, so LAANC cannot approve this flight."
    ));
  }
  if (!noLaunch && !zeroGrid && (lowCeiling || gridControlled || surfaceControlled)) {
    const ceiling = facility.ok ? facility.ceilingFt : null;
    const label = ceiling != null ? `LAANC authorization (up to ${ceiling} ft)` : "LAANC authorization";
    const why = ceiling != null
      ? `Free, and usually instant, up to ${ceiling} ft. FAA DroneZone is the fallback if LAANC is unavailable.`
      : "The facility map has no cell here, so confirm the ceiling in a LAANC app. FAA DroneZone is the fallback.";
    items.push(item("laanc", label, why));
  }
  if (insideSfra) {
    items.push(item(
      "sfra",
      "DC SFRA notes",
      "Outside the FRZ, normal Part 107 rules still apply, plus the SFRA operating notes. This is not the special waiver."
    ));
  }
  return [...items, ...alwaysOnChecklist()];
}

function summaryFor({ verdict, insideFrz, insideP56, insideNps, failures, facility }) {
  if (insideFrz) {
    return "Not realistic: needs an FAA/TSA special waiver, rarely approved for real estate/promo.";
  }
  if (verdict === "Not realistic") {
    const zeroGrid = facility.ok && facility.ceilingFt === 0;
    const noTakeoff = insideP56 || insideNps;
    if (zeroGrid && noTakeoff) {
      return "Not realistic. A no-takeoff zone covers this point, and the facility-map grid is 0 ft (FAA DroneZone only).";
    }
    if (zeroGrid) {
      return "Not realistic for a routine quote: the facility-map grid is 0 ft, so the path is FAA DroneZone only.";
    }
    return "Not realistic. A no-takeoff zone covers this point.";
  }
  if (verdict === "Couldn't verify") {
    return `Couldn't verify. ${failures.join("; ")} failed, so this check will not guess.`;
  }
  if (verdict === "Needs LAANC") {
    const ceiling = facility.ok && facility.ceilingFt != null ? `${facility.ceilingFt} ft` : "an unpublished ceiling";
    return `Needs LAANC (free, usually instant), up to ${ceiling}. FAA DroneZone is the fallback.`;
  }
  return "Realistic under normal Part 107 rules.";
}

function authorizationFor({
  verdict,
  blocks,
  failures,
  insideSfra,
  facility,
  airspace,
  lowCeiling,
  gridControlled,
  surfaceControlled,
}) {
  const lines = blocks.map((block) => block.authorization);
  if (verdict === "Couldn't verify") {
    lines.push(`Couldn't verify ${failures.join("; ")}. Do not quote from the missing piece.`);
  } else if (failures.length) {
    lines.push(`Couldn't verify ${failures.join("; ")}. That part is not guessed.`);
  }
  if (verdict === "Needs LAANC") {
    const ceiling = facility.ok && facility.ceilingFt != null ? `${facility.ceilingFt} ft` : null;
    if (facility.ok && facility.ceilingFt === null) {
      lines.push(
        "Before quoting: LAANC (free, usually instant). The facility map has no cell here, so read the ceiling in a LAANC app. FAA DroneZone is the fallback."
      );
    } else if (lowCeiling || gridControlled) {
      lines.push(
        `Before quoting: LAANC authorization (free, usually instant)${ceiling ? ` up to ${ceiling}` : ""}. FAA DroneZone is the fallback if LAANC is unavailable.`
      );
    } else if (surfaceControlled) {
      const classes = airspace.surfaceClasses.join(", ");
      lines.push(
        `Before quoting: LAANC authorization (free, usually instant). The point is in surface Class ${classes} airspace. FAA DroneZone is the fallback.`
      );
    }
  }
  if (verdict === "Realistic") {
    lines.push(
      insideSfra
        ? "Before quoting: a normal Part 107 plan, plus the DC SFRA notes. No special waiver showed up outside the FRZ."
        : "Before quoting: a normal Part 107 plan. These sources did not show an extra airspace authorization."
    );
  }
  if (insideSfra && verdict !== "Realistic") {
    lines.push("The point is also in the DC SFRA, outside the FRZ. The SFRA notes still apply on top of the item above.");
  }
  return lines.join(" ");
}

function ceilingText(facility) {
  if (!facility.ok) return "Couldn't verify";
  if (facility.ceilingFt == null) return "No facility-map cell at this point";
  return `${facility.ceilingFt} ft`;
}

function shelfNote(airspace) {
  if (!airspace.ok) return null;
  const parts = [];
  if (airspace.surfaceClasses.length) {
    parts.push(`Surface Class ${airspace.surfaceClasses.join(", ")} covers this point.`);
  }
  if (airspace.shelves.length) {
    const shelf = airspace.shelves[0];
    parts.push(
      `A Class ${shelf.class} shelf begins at ${shelf.floorFt.toLocaleString("en-US")} ft MSL (${shelf.name}). That shelf is above a normal Part 107 flight, so the shelf itself is not treated as surface controlled airspace.`
    );
  }
  return parts.length ? parts.join(" ") : null;
}

export async function checkPoint(lat, lng, fetchImpl = fetch) {
  const [frz, facilityMap, classAirspace, p56, nps] = await Promise.all([
    queryPoint(fetchImpl, {
      url: SOURCES.frz.url,
      lat,
      lng,
      where: "LOCAL_TYPE = 'SFRA' AND CITY = 'WASHINGTON'",
      outFields: "NAME,SECTOR,LOCAL_TYPE",
    }),
    queryPoint(fetchImpl, {
      url: SOURCES.facilityMap.url,
      lat,
      lng,
      where: "1=1",
      outFields: "CEILING,UNIT,AIRSPACE_1,AIRSPACE_2,AIRSPACE_3,AIRSPACE_4,AIRSPACE_5,APT1_NAME,APT1_FAAID,APT1_LAANC",
    }),
    queryPoint(fetchImpl, {
      url: SOURCES.classAirspace.url,
      lat,
      lng,
      where: "TYPE_CODE = 'CLASS'",
      outFields: "NAME,CLASS,LOWER_VAL,UPPER_VAL,LOCAL_TYPE",
      limit: 25,
    }),
    queryPoint(fetchImpl, {
      url: SOURCES.p56.url,
      lat,
      lng,
      where: "NAME = 'P-56' AND TYPE_CODE = 'P'",
      outFields: "NAME,TYPE_CODE,CITY,LOWER_VAL,UPPER_VAL",
    }),
    queryPoint(fetchImpl, {
      url: SOURCES.nps.url,
      lat,
      lng,
      where: "1=1",
      outFields: "UNIT_NAME,UNIT_CODE,PARKNAME",
    }),
  ]);

  const frzFacts = frz.ok ? readFrz(frz.features) : { ok: false };
  const facilityFacts = facilityMap.ok ? readFacilityMap(facilityMap.features) : { ok: false };
  const classFacts = classAirspace.ok ? readClassAirspace(classAirspace.features) : { ok: false, surfaceClasses: [], shelves: [] };
  const p56Facts = p56.ok ? { ok: true, inside: p56.features.length > 0 } : { ok: false, inside: false };
  const npsFacts = nps.ok
    ? {
        ok: true,
        inside: nps.features.length > 0,
        units: unique(nps.features.map((feature) => feature.attributes?.UNIT_NAME).filter(Boolean)),
      }
    : { ok: false, inside: false, units: [] };

  const verdict = classifyAirspace({
    frz: frzFacts,
    facilityMap: facilityFacts,
    classAirspace: classFacts.ok ? classFacts : { ok: false, surfaceClasses: [], shelves: [] },
    p56: p56Facts,
    nps: npsFacts,
  });

  return {
    ...verdict,
    zones: {
      frz: zoneStatus(frzFacts.ok, frzFacts.insideFrz, frzFacts.insideFrz ? "Inside the DC FRZ." : "Outside the DC FRZ."),
      sfra: zoneStatus(
        frzFacts.ok,
        Boolean(frzFacts.ok && frzFacts.insideSfra),
        frzFacts.insideFrz
          ? "Inside the DC SFRA as well, because the FRZ is part of it."
          : frzFacts.insideSfra
            ? "Inside the DC SFRA, outside the FRZ."
            : "Outside the DC SFRA."
      ),
      p56: zoneStatus(p56Facts.ok, p56Facts.inside, p56Facts.inside ? "Inside P-56 prohibited airspace." : "Outside P-56."),
      nps: zoneStatus(
        npsFacts.ok,
        npsFacts.inside,
        npsFacts.inside ? `Inside ${npsFacts.units.join(", ")}.` : "Not inside an NPS legislated boundary at this point."
      ),
    },
    facility: facilityFacts.ok
      ? {
          ceilingFt: facilityFacts.ceilingFt,
          ceilingText: verdict.ceilingText,
          airspace: facilityFacts.airspaces,
          airport: facilityFacts.airport,
        }
      : { ceilingFt: null, ceilingText: "Couldn't verify", airspace: [], airport: null },
    classAirspace: classFacts.ok
      ? { surfaceClasses: classFacts.surfaceClasses, shelves: classFacts.shelves }
      : { surfaceClasses: [], shelves: [], failed: true },
    sources: [
      sourceRow(SOURCES.frz, frz.ok),
      sourceRow(SOURCES.facilityMap, facilityMap.ok),
      sourceRow(SOURCES.classAirspace, classAirspace.ok),
      sourceRow(SOURCES.p56, p56.ok),
      sourceRow(SOURCES.nps, nps.ok),
      { ...RULE_REFERENCE, id: "cfr", status: "reference", limit: "The regulation the FRZ and SFRA polygons implement. Not queried as a geometry." },
    ],
    disclaimer: DISCLAIMER,
  };
}

function zoneStatus(ok, inside, detail) {
  if (!ok) return { status: "couldn't verify", inside: null, detail: "Couldn't verify." };
  return { status: inside ? "inside" : "outside", inside, detail };
}

function sourceRow(source, ok) {
  return { ...source, status: ok ? "ok" : "couldn't verify" };
}

function readFrz(features) {
  const sectors = features.map((feature) => String(feature.attributes?.SECTOR || "").trim().toUpperCase());
  const insideFrz = sectors.includes("DC FRZ");
  const insideSfra = sectors.includes("DC SFRA") || insideFrz;
  return { ok: true, insideFrz, insideSfra };
}

function readFacilityMap(features) {
  if (!features.length) {
    return { ok: true, ceilingFt: null, airspaces: [], controlled: false, airport: null };
  }
  const ceilings = features
    .map((feature) => numberOrNull(feature.attributes?.CEILING))
    .filter((value) => value != null);
  const ceilingFt = ceilings.length ? Math.min(...ceilings) : null;
  const airspaces = unique(
    features.flatMap((feature) =>
      [1, 2, 3, 4, 5]
        .map((index) => String(feature.attributes?.[`AIRSPACE_${index}`] || "").trim().toUpperCase())
        .filter((code) => CONTROLLED.has(code))
    )
  );
  const airport = features.map((feature) => feature.attributes?.APT1_NAME).find(Boolean) || null;
  return { ok: true, ceilingFt, airspaces, controlled: airspaces.length > 0, airport };
}

function readClassAirspace(features) {
  const surface = new Set();
  const shelves = [];
  for (const feature of features) {
    const code = String(feature.attributes?.CLASS || "").trim().toUpperCase();
    if (!CONTROLLED.has(code)) continue;
    const floor = numberOrNull(feature.attributes?.LOWER_VAL);
    if (floor == null || floor < 0) continue;
    if (floor === 0) {
      surface.add(code);
    } else if (code !== "E") {
      shelves.push({
        class: code,
        floorFt: floor,
        name: String(feature.attributes?.NAME || "Class airspace"),
      });
    }
  }
  shelves.sort((a, b) => a.floorFt - b.floorFt);
  return {
    ok: true,
    surfaceClasses: [...surface],
    shelves: shelves.slice(0, 2),
  };
}

async function queryPoint(fetchImpl, { url, lat, lng, where, outFields, limit = 10 }) {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    where,
    outFields,
    returnGeometry: "false",
    resultRecordCount: String(limit),
    f: "json",
  });
  const endpoint = `${url}/query?${params}`;

  let lastReason = "network";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        headers: { Accept: "application/json", "User-Agent": "SleepySquid-airspace-check" },
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      lastReason = "network";
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      lastReason = `http_${response.status}`;
      await delay(1200);
      continue;
    }
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    const body = await response.json().catch(() => null);
    if (!body || body.error) {
      const code = body?.error?.code;
      if (code === 429 && attempt === 0) {
        await delay(1200);
        continue;
      }
      return { ok: false, reason: "service_error" };
    }
    if (body.exceededTransferLimit) return { ok: false, reason: "incomplete" };
    if (!Array.isArray(body.features)) return { ok: false, reason: "invalid" };
    return { ok: true, features: body.features };
  }
  return { ok: false, reason: lastReason };
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values) {
  return [...new Set(values)];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
