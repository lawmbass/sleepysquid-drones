/**
 * A booking location is either a Places suggestion or a geocoded US address.
 * Callers store the formatted address plus latitude/longitude. The Maps key
 * never leaves the server.
 */

import { randomUUID } from "crypto";
import { geocodeUsAddress } from "./geocode.js";
import { countryCodeFromPlace, isPlaceId, pinFromPlaceDetails, placeDetails } from "./places.js";

export function bookingAddressFromDetails(body) {
  if (countryCodeFromPlace(body) !== "US") return null;
  const pin = pinFromPlaceDetails(body);
  if (!pin || pin.formattedAddress.length > 200) return null;
  return pin;
}

export function bookingAddressError(reason) {
  if (reason === "no_key") {
    return {
      status: 503,
      message: "Address search isn't available right now.",
    };
  }
  if (reason === "network" || reason === "http" || reason === "REQUEST_DENIED" || reason === "PERMISSION_DENIED") {
    return {
      status: reason === "REQUEST_DENIED" || reason === "PERMISSION_DENIED" ? 503 : 502,
      message: "We couldn't look up that address. Try again.",
    };
  }
  return {
    status: 400,
    message: "Choose a US address from the list.",
  };
}

export async function resolveUsBookingAddress({ placeId, location } = {}) {
  if (isPlaceId(placeId)) {
    const lookup = await placeDetails(placeId, randomUUID());
    if (!lookup.ok) return { ok: false, reason: lookup.reason };
    if (lookup.countryCode !== "US") return { ok: false, reason: "not_us" };
    if (!lookup.formattedAddress || lookup.formattedAddress.length > 200) {
      return { ok: false, reason: "too_long" };
    }
    return {
      ok: true,
      location: lookup.formattedAddress,
      lat: lookup.lat,
      lng: lookup.lng,
    };
  }

  const geocoded = await geocodeUsAddress(location);
  if (!geocoded.ok) {
    return { ok: false, reason: geocoded.reason === "no_key" ? "no_key" : "not_us" };
  }
  return {
    ok: true,
    location: geocoded.formattedAddress,
    lat: geocoded.lat,
    lng: geocoded.lng,
  };
}
