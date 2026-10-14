import assert from "node:assert/strict";
import fs from "node:fs";

const { countryCodeFromPlace, pinFromPlaceDetails } = await import("../libs/places.js");
const { usPinFromGeocodeBody } = await import("../libs/geocode.js");
const { bookingAddressError, bookingAddressFromDetails } = await import("../libs/bookingAddress.js");

const usPlace = {
  shortFormattedAddress: "10 Main St, Annapolis, MD 21401",
  formattedAddress: "10 Main Street, Annapolis, MD 21401, USA",
  location: { latitude: 38.9784, longitude: -76.4922 },
  addressComponents: [
    { shortText: "US", types: ["country", "political"] },
  ],
};

assert.equal(countryCodeFromPlace(usPlace), "US");
assert.deepEqual(bookingAddressFromDetails(usPlace), {
  formattedAddress: "10 Main St, Annapolis, MD 21401",
  lat: 38.9784,
  lng: -76.4922,
});

const canada = {
  ...usPlace,
  addressComponents: [{ shortText: "CA", types: ["country"] }],
};
assert.equal(bookingAddressFromDetails(canada), null);
assert.equal(bookingAddressFromDetails({ ...usPlace, addressComponents: [] }), null);
assert.equal(pinFromPlaceDetails(canada).formattedAddress, "10 Main St, Annapolis, MD 21401");

const tooLong = {
  ...usPlace,
  shortFormattedAddress: "x".repeat(201),
  formattedAddress: "x".repeat(201),
};
assert.equal(bookingAddressFromDetails(tooLong), null);

const geocoded = usPinFromGeocodeBody({
  status: "OK",
  results: [{
    formatted_address: "10 Main St, Annapolis, MD 21401, USA",
    geometry: { location: { lat: 38.9784, lng: -76.4922 } },
    address_components: [{ short_name: "US", types: ["country", "political"] }],
  }],
});
assert.equal(geocoded.formattedAddress, "10 Main St, Annapolis, MD 21401, USA");
assert.equal(usPinFromGeocodeBody({
  status: "OK",
  results: [{
    formatted_address: "10 Downing Street, London, UK",
    geometry: { location: { lat: 51.5, lng: -0.12 } },
    address_components: [{ short_name: "GB", types: ["country"] }],
  }],
}), null);
assert.equal(usPinFromGeocodeBody({ status: "ZERO_RESULTS", results: [] }), null);

assert.equal(bookingAddressError("not_us").status, 400);
assert.equal(bookingAddressError("not_us").message, "Choose a US address from the list.");
assert.equal(bookingAddressError("no_key").status, 503);

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const places = read("../libs/places.js");
assert.match(places, /includedRegionCodes: \["us"\]/);
const geocode = read("../libs/geocode.js");
assert.match(geocode, /components", "country:US"/);

for (const path of ["../pages/api/places/autocomplete.js", "../pages/api/places/details.js"]) {
  const source = read(path);
  assert.match(source, /placesRateLimit/);
  assert.doesNotMatch(source, /requireAdmin/);
  assert.doesNotMatch(source, /GOOGLE_MAPS_API_KEY/);
  assert.doesNotMatch(source, /X-Goog-Api-Key/);
  assert.doesNotMatch(source, /maps\.googleapis\.com/);
}
assert.match(read("../pages/api/places/details.js"), /countryCode !== "US"/);

const publicForm = read("../components/home/BookingSection.jsx");
assert.match(publicForm, /\/api\/places\/autocomplete/);
assert.match(publicForm, /\/api\/places\/details/);
assert.match(publicForm, /Choose a US address from the list/);
assert.match(publicForm, /placeId/);
assert.doesNotMatch(publicForm, /GOOGLE_MAPS_API_KEY/);

const adminForm = read("../components/admin/AddBookingForm.jsx");
assert.match(adminForm, /\/api\/admin\/places\/autocomplete/);
assert.match(adminForm, /\/api\/admin\/places\/details/);
assert.match(adminForm, /Choose a US address from the list/);

for (const path of ["../pages/api/bookings.js", "../pages/api/admin/bookings/create.js"]) {
  const source = read(path);
  assert.match(source, /resolveUsBookingAddress/);
  assert.match(source, /coordinates: \{ lat: address\.lat, lng: address\.lng \}/);
}
const publicApi = read("../pages/api/bookings.js");
assert.match(publicApi, /findSameDayBooking/);
assert.match(publicApi, /sendBookingConfirmationEmail/);
assert.match(publicApi, /source: 'customer'/);

const homeField = read("../components/admin/HomeAddressField.jsx");
assert.match(homeField, /\/api\/admin\/places\/autocomplete/);

console.log("booking address checks passed");
