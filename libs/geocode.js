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

  return {
    ok: true,
    lat: location.lat,
    lng: location.lng,
  };
}
