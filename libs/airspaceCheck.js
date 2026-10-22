import { geocodeAddress } from "./geocode.js";
import { DISCLAIMER, alwaysOnChecklist, checkPoint } from "./airspaceData.mjs";

/**
 * Geocode with GOOGLE_MAPS_API_KEY, then classify the point.
 * A geocode failure does not fall through to another locator.
 */
export async function checkAddress(address, picked = null) {
  const query = String(address || "").trim();
  // A suggestion picked from the address list already carries its point.
  const geo = picked
    ? { ok: true, lat: picked.lat, lng: picked.lng, formattedAddress: picked.formattedAddress || query }
    : await geocodeAddress(query);
  if (!geo.ok) {
    return {
      query,
      formattedAddress: null,
      latitude: null,
      longitude: null,
      verdict: "Couldn't verify",
      summary: geocodeSummary(geo.reason),
      authorization: "Don't quote from this check until the address geocodes.",
      ceilingText: "Couldn't verify",
      ceilingFt: null,
      sfraNote: null,
      shelfNote: null,
      zones: {
        frz: unverifiedZone(),
        sfra: unverifiedZone(),
        p56: unverifiedZone(),
        nps: unverifiedZone(),
      },
      facility: { ceilingFt: null, ceilingText: "Couldn't verify", airspace: [], airport: null },
      classAirspace: { surfaceClasses: [], shelves: [], failed: true },
      sources: [
        {
          id: "geocode",
          name: "Google Geocoding API",
          url: "https://developers.google.com/maps/documentation/geocoding",
          status: "couldn't verify",
          limit: "Server-side only, using GOOGLE_MAPS_API_KEY. The key is not sent to the browser.",
        },
      ],
      disclaimer: DISCLAIMER,
      failures: ["Google Geocoding API"],
      checklist: alwaysOnChecklist(),
    };
  }

  const point = await checkPoint(geo.lat, geo.lng);
  return {
    query,
    formattedAddress: geo.formattedAddress,
    latitude: geo.lat,
    longitude: geo.lng,
    ...point,
    sources: [
      {
        id: "geocode",
        name: picked ? "Google Places" : "Google Geocoding API",
        url: picked
          ? "https://developers.google.com/maps/documentation/places/web-service"
          : "https://developers.google.com/maps/documentation/geocoding",
        status: "ok",
        limit: picked
          ? "The point is the picked place's location, not a surveyed takeoff spot."
          : "The point is the geocoder's match for the address, not a surveyed takeoff spot.",
      },
      ...point.sources,
    ],
  };
}

function geocodeSummary(reason) {
  if (reason === "no_key") {
    return "Couldn't verify. GOOGLE_MAPS_API_KEY is not set, so the address was not geocoded.";
  }
  return "Couldn't verify. Geocoding did not return a point, so no airspace source was queried.";
}

function unverifiedZone() {
  return { status: "couldn't verify", inside: null, detail: "Couldn't verify." };
}
