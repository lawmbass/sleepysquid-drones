/**
 * Server-side lookup for a home address on the Bot rules page.
 * Uses GOOGLE_MAPS_API_KEY when it is set. The NextAuth Google client
 * (GOOGLE_ID / GOOGLE_SECRET) is not a Maps key and is not used here.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export function mapsApiKey() {
  const key = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  return key || null;
}

export async function geocodeAddress(address) {
  const key = mapsApiKey();
  if (!key) {
    return { ok: false, reason: "no_key" };
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (!response.ok) {
    return { ok: false, reason: "http" };
  }

  const body = await response.json().catch(() => null);
  const location = body?.results?.[0]?.geometry?.location;
  if (body?.status !== "OK" || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
    return { ok: false, reason: body?.status || "empty" };
  }

  const formattedAddress = String(body.results[0].formatted_address || "").trim();
  return {
    ok: true,
    lat: location.lat,
    lng: location.lng,
    formattedAddress: formattedAddress || null,
  };
}

export function usPinFromGeocodeBody(body) {
  if (body?.status !== "OK" || !Array.isArray(body.results) || !body.results[0]) return null;
  const result = body.results[0];
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const country = components.find((item) => Array.isArray(item?.types) && item.types.includes("country"));
  if (String(country?.short_name || "").toUpperCase() !== "US") return null;
  const lat = Number(result.geometry?.location?.lat);
  const lng = Number(result.geometry?.location?.lng);
  const formattedAddress = String(result.formatted_address || "").trim();
  if (!formattedAddress || formattedAddress.length > 200) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { formattedAddress, lat, lng };
}

/** Geocode restricted to the United States. The key stays on the server. */
export async function geocodeUsAddress(address) {
  const key = mapsApiKey();
  if (!key) return { ok: false, reason: "no_key" };
  const text = String(address || "").trim();
  if (text.length < 3 || text.length > 200) return { ok: false, reason: "bad_address" };

  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", text);
  url.searchParams.set("components", "country:US");
  url.searchParams.set("key", key);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (!response.ok) return { ok: false, reason: "http" };
  const body = await response.json().catch(() => null);
  const pin = usPinFromGeocodeBody(body);
  if (!pin) return { ok: false, reason: "not_us" };
  return { ok: true, ...pin };
}
