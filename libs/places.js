/**
 * Server-side Places API (New) and Static Maps calls for the Bot rules
 * address box. GOOGLE_MAPS_API_KEY stays in this process. Callers must
 * not send the key, the Google URL, or a raw Google error body to the browser.
 */

import { mapsApiKey } from "./geocode.js";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_PREFIX = "https://places.googleapis.com/v1/places/";
const STATIC_MAP_URL = "https://maps.googleapis.com/maps/api/staticmap";

const AUTOCOMPLETE_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
].join(",");

const DETAILS_MASK = "formattedAddress,shortFormattedAddress,location,addressComponents";

const HOME_BIAS = {
  circle: {
    center: { latitude: 38.737679, longitude: -76.894043 },
    radius: 50000,
  },
};

export function isSessionToken(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function isPlaceId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,200}$/.test(value);
}

export function placesError(reason) {
  const unavailable = reason === "no_key" || reason === "REQUEST_DENIED" || reason === "PERMISSION_DENIED";
  return {
    status: unavailable ? 503 : 502,
    body: {
      error: "Address search failed",
      code: unavailable ? "search_unavailable" : "lookup_failed",
      message: unavailable
        ? "Address search isn't available right now."
        : "We couldn't look up that address. Try again, or enter the coordinates.",
    },
  };
}

export function suggestionsFromAutocomplete(body) {
  const list = Array.isArray(body?.suggestions) ? body.suggestions : [];
  const seen = new Set();
  const suggestions = [];
  for (const item of list) {
    const prediction = item?.placePrediction;
    const placeId = prediction?.placeId;
    const label = typeof prediction?.text?.text === "string" ? prediction.text.text.trim() : "";
    if (!isPlaceId(placeId) || !label || seen.has(placeId)) continue;
    seen.add(placeId);
    suggestions.push({
      placeId,
      label,
      mainText: prediction?.structuredFormat?.mainText?.text || label,
      secondaryText: prediction?.structuredFormat?.secondaryText?.text || "",
    });
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

export function countryCodeFromPlace(body) {
  const components = Array.isArray(body?.addressComponents) ? body.addressComponents : [];
  const country = components.find((item) => Array.isArray(item?.types) && item.types.includes("country"));
  const code = String(country?.shortText || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function pinFromPlaceDetails(body) {
  const lat = Number(body?.location?.latitude);
  const lng = Number(body?.location?.longitude);
  const formatted = String(body?.shortFormattedAddress || body?.formattedAddress || "").trim();
  if (!formatted || formatted.length > 300) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { formattedAddress: formatted, lat, lng };
}

// Google's machine reason (e.g. API_KEY_INVALID, SERVICE_DISABLED, API_KEY_HTTP_REFERRER_BLOCKED).
// Never includes the key.
function googleReason(body) {
  const info = (body?.error?.details || []).find((d) => d?.reason);
  return info ? String(info.reason).slice(0, 60) : null;
}

async function googleFetch(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
}

export async function autocompletePlaces(input, sessionToken) {
  const key = mapsApiKey();
  if (!key) return { ok: false, reason: "no_key" };

  const response = await googleFetch(AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": AUTOCOMPLETE_MASK,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      languageCode: "en",
      includedRegionCodes: ["us"],
      locationBias: HOME_BIAS,
    }),
  });
  if (!response) return { ok: false, reason: "network" };
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, reason: body?.error?.status || "http", detail: googleReason(body) };
  }
  return { ok: true, suggestions: suggestionsFromAutocomplete(body) };
}

export async function placeDetails(placeId, sessionToken) {
  const key = mapsApiKey();
  if (!key) return { ok: false, reason: "no_key" };
  if (!isPlaceId(placeId)) return { ok: false, reason: "bad_place" };

  const url = new URL(`${DETAILS_PREFIX}${placeId}`);
  url.searchParams.set("sessionToken", sessionToken);
  const response = await googleFetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": DETAILS_MASK,
    },
  });
  if (!response) return { ok: false, reason: "network" };
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, reason: body?.error?.status || "http", detail: googleReason(body) };
  }
  const pin = pinFromPlaceDetails(body);
  if (!pin) return { ok: false, reason: "empty" };
  return { ok: true, ...pin, countryCode: countryCodeFromPlace(body) };
}

export async function staticMapImage(lat, lng) {
  const key = mapsApiKey();
  if (!key) return { ok: false, reason: "no_key" };
  const url = new URL(STATIC_MAP_URL);
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", "16");
  url.searchParams.set("size", "640x200");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("markers", `color:0x1d4ed8|${lat},${lng}`);
  url.searchParams.set("key", key);

  const response = await googleFetch(url, { headers: { Accept: "image/png" } });
  if (!response?.ok) return { ok: false, reason: "http" };
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return { ok: false, reason: "not_image" };
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) return { ok: false, reason: "empty" };
  return { ok: true, bytes, type: type.split(";")[0] };
}
