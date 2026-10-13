/**
 * Drive minutes from a draft home pin to recent mission listings.
 * Uses the Routes API with GOOGLE_MAPS_API_KEY. Results stay in memory
 * for this process. Nothing here writes travel_time.
 */

import { mapsApiKey } from "./geocode.js";
import { normalizeAddress } from "./botRules.js";

export const MAX_ROUTE_CALLS = 30;
const CACHE_TTL_MS = 10 * 60 * 1000;
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

const cache = new Map();

export function clearDriveTimeCache() {
  cache.clear();
}

function coordinatePair(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: latitude, lng: longitude };
}

export function destinationForListing(listing) {
  const pin = coordinatePair(listing?.latitude ?? listing?.lat, listing?.longitude ?? listing?.lng);
  if (pin) return { kind: "coordinates", ...pin };
  const address = normalizeAddress(listing?.address);
  if (address) return { kind: "address", address };
  return { kind: "missing" };
}

export function minutesFromDuration(duration) {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(String(duration || "").trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds / 60);
}

function roundCoord(value) {
  return Number(value).toFixed(5);
}

export function driveCacheKey(origin, destination) {
  const home = `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
  if (destination.kind === "coordinates") {
    return `${home}|c|${roundCoord(destination.lat)},${roundCoord(destination.lng)}`;
  }
  return `${home}|a|${destination.address.toLowerCase()}`;
}

function readCache(key, now) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.minutes;
}

function writeCache(key, minutes, now) {
  cache.set(key, { at: now, minutes });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function waypoint(destination) {
  if (destination.kind === "coordinates") {
    return {
      location: {
        latLng: { latitude: destination.lat, longitude: destination.lng },
      },
    };
  }
  return { address: destination.address };
}

async function routeMinutes(origin, destination, apiKey, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: origin.lat, longitude: origin.lng },
          },
        },
        destination: waypoint(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { error: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { denied: true };
  }
  if (!response.ok) return { error: true };

  const body = await response.json().catch(() => null);
  return { minutes: minutesFromDuration(body?.routes?.[0]?.duration) };
}

function newestFirst(listings) {
  return listings
    .map((listing, index) => ({ listing, index }))
    .sort((a, b) => {
      const aTime = new Date(a.listing.firstSeenAt || a.listing.first_seen_at || 0).getTime();
      const bTime = new Date(b.listing.firstSeenAt || b.listing.first_seen_at || 0).getTime();
      const aMs = Number.isFinite(aTime) ? aTime : 0;
      const bMs = Number.isFinite(bTime) ? bTime : 0;
      if (aMs !== bMs) return bMs - aMs;
      return b.index - a.index;
    })
    .map((item) => item.listing);
}

/**
 * Minutes from origin to each listing. Cache hits are free. At most
 * MAX_ROUTE_CALLS uncached Routes requests run, newest listings first.
 * A null or 0,0 mission pin uses the listing address. This does not write.
 */
export async function computePreviewDriveTimes(origin, listings, options = {}) {
  const apiKey = options.apiKey === undefined ? mapsApiKey() : options.apiKey;
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || Date.now();
  const byId = new Map();
  const rows = Array.isArray(listings) ? listings : [];

  if (!apiKey) {
    return { ok: false, reason: "no_key", byId, calls: 0, cacheHits: 0, capped: false };
  }

  const originPin = coordinatePair(origin?.lat, origin?.lng);
  if (!originPin) {
    return { ok: false, reason: "bad_origin", byId, calls: 0, cacheHits: 0, capped: false };
  }

  const queue = [];
  let reserved = 0;
  let cacheHits = 0;
  let capped = false;

  for (const listing of newestFirst(rows)) {
    const id = listing?.id;
    if (id == null) continue;
    const destination = destinationForListing(listing);
    if (destination.kind === "missing") {
      byId.set(id, { minutes: null, source: "missing" });
      continue;
    }
    const key = driveCacheKey(originPin, destination);
    const cached = readCache(key, now);
    if (cached !== undefined) {
      cacheHits += 1;
      byId.set(id, { minutes: cached, source: destination.kind });
      continue;
    }
    if (reserved >= MAX_ROUTE_CALLS) {
      capped = true;
      byId.set(id, { minutes: null, source: "capped" });
      continue;
    }
    reserved += 1;
    queue.push({ id, destination, key });
  }

  let calls = 0;
  let denied = false;

  for (let index = 0; index < queue.length; index += 4) {
    if (denied) break;
    const batch = queue.slice(index, index + 4);
    const results = await Promise.all(
      batch.map(async (item) => {
        const result = await routeMinutes(originPin, item.destination, apiKey, fetchImpl);
        return { item, result };
      })
    );
    for (const { item, result } of results) {
      calls += 1;
      if (result.denied) {
        denied = true;
        byId.set(item.id, { minutes: null, source: "error" });
        continue;
      }
      if (result.error) {
        byId.set(item.id, { minutes: null, source: "error" });
        continue;
      }
      writeCache(item.key, result.minutes, now);
      byId.set(item.id, { minutes: result.minutes, source: item.destination.kind });
    }
  }

  if (denied) {
    return { ok: false, reason: "denied", byId, calls, cacheHits, capped };
  }

  return { ok: true, byId, calls, cacheHits, capped };
}

export function listingsWithDraftDrives(listings, byId) {
  return (Array.isArray(listings) ? listings : []).map((listing) => {
    const result = byId?.get?.(listing.id);
    if (!result || result.source === "capped" || result.source === "error") return listing;
    return { ...listing, travelTime: result.minutes };
  });
}

/**
 * True when every computed minute matches the stored travel time.
 * Null when nothing could be compared.
 */
export function storedDrivesMatch(listings, byId) {
  let compared = 0;
  let mismatched = 0;
  for (const listing of Array.isArray(listings) ? listings : []) {
    const result = byId?.get?.(listing.id);
    if (!result || result.minutes == null) continue;
    if (result.source === "capped" || result.source === "error") continue;
    compared += 1;
    const stored = listing.travelTime == null || listing.travelTime === ""
      ? null
      : Math.round(Number(listing.travelTime));
    if (stored !== result.minutes) mismatched += 1;
  }
  if (compared === 0) return null;
  return mismatched === 0;
}
