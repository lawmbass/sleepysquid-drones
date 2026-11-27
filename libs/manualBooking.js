/**
 * Admin "Add booking" rules. Matches the public form's service list,
 * package rules, and date/email checks. Source is "manual" because
 * bookings_source_check allows customer, zeitview, manual, flyguys, and droners.
 */

import { DEFAULT_SERVICE_LINE, isServiceLine } from "./serviceLines.js";
import { formatReferralDollars } from "./referralPrice.mjs";

export const MANUAL_SOURCE = "manual";
/** Location stored for non-drone bookings. */
export const REMOTE_LOCATION = "Remote";
export const MANUAL_SOURCE_LABEL = "Added by admin";

export const BOOKING_SERVICES = [
  { id: "aerial-media", name: "Aerial Photography & Videography" },
  { id: "mapping-surveying", name: "Mapping & Surveying" },
  { id: "real-estate", name: "Real Estate Tours" },
  { id: "inspection", name: "Inspection Services" },
  { id: "event-coverage", name: "Event Coverage" },
  { id: "custom", name: "Custom Project" },
];

/** Shown on the roof card and again when that package is selected. Photos only. */
export const ROOF_DISCLAIMER_LINES = [
  "Photos only — not a licensed roof inspection, damage diagnosis, claim opinion, thermal scan, or roof measurement report.",
  "Multi-building properties by quote; no towers, power lines, or utility infrastructure; return visits are a separate booking.",
  "Add-ons (raw files, next-day delivery, short video, extra travel) on request.",
];

const ROOF_DETAILS = [
  "20–30 edited high-resolution photos of one structure",
  "Roof planes, ridges/valleys, gutters, flashing, chimneys/vents, and four-side elevations",
  "Labeled N/S/E/W in a download folder",
  "48-hour delivery",
  "Travel within 25 miles of Burtonsville, MD",
  "Commercial use license",
  "Certificate of Insurance ($1M liability) on request",
];

const CONSTRUCTION_DETAILS = [
  "20–30 edited photos per visit from repeatable GPS points and altitudes",
  "1 overhead overview",
  "Dated folder within 48 hours",
  "Commercial use license",
  "Certificate of Insurance ($1M liability) on request",
];

export const BOOKING_PACKAGES = [
  {
    id: "listing-photos",
    basePrice: 199,
    name: "Listing Photos",
    quote: false,
    details: ["15-20 edited photos", "48-hour delivery"],
  },
  {
    id: "listing-video",
    basePrice: 399,
    name: "Listing Photos + Video",
    quote: false,
    badge: "Best for listings",
    details: ["15-20 edited photos", "Short edited video up to 2 min", "48-hour delivery"],
  },
  {
    id: "event-aerials",
    basePrice: 500,
    name: "Event Aerials",
    quote: true,
    details: ["Photo and video coverage", "Priced by event"],
  },
  {
    id: "mapping-3d",
    basePrice: 900,
    name: "Mapping & 3D",
    quote: true,
    details: ["By quote"],
  },
  {
    id: "roof-property-condition",
    basePrice: 249,
    name: "Roof & Property Condition",
    quote: false,
    billing: "structure",
    details: ROOF_DETAILS,
    disclaimer: ROOF_DISCLAIMER_LINES,
  },
  {
    id: "construction-single-visit",
    basePrice: 350,
    name: "Construction Progress (single visit)",
    quote: false,
    billing: "visit",
    details: CONSTRUCTION_DETAILS,
  },
  {
    id: "construction-monthly-2",
    basePrice: 650,
    name: "Construction Progress (2 visits/mo)",
    quote: false,
    billing: "month",
    details: CONSTRUCTION_DETAILS,
  },
  {
    id: "construction-monthly-4",
    basePrice: 1200,
    name: "Construction Progress (4 visits/mo)",
    quote: false,
    billing: "month",
    details: CONSTRUCTION_DETAILS,
  },
];

const LEGACY_PACKAGE_PRICES = {
  basic: 199,
  standard: 399,
  premium: 799,
};

const LEGACY_PACKAGE_LABELS = {
  basic: "Basic (previous tier)",
  standard: "Standard (previous tier)",
  premium: "Premium (previous tier)",
};

export const BOOKING_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/** Pending bookings may be saved before the address, email, or phone is known. */
export function contactOptional(status) {
  return (status || "pending") === "pending";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+]?[\d\s\-()]{10,}$/;

/** Format checks for location/email/phone. Blank is allowed when optional is true. */
export function validateContactFields({ location, email, phone, optional, requireLocation = true }) {
  const errors = {};
  if (!location) {
    if (requireLocation && !optional) errors.location = "Please enter a location";
  } else if (location.length > 200) {
    errors.location = "Location must be 200 characters or fewer";
  }
  if (!email) {
    if (!optional) errors.email = "Please enter an email";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Please enter a valid email";
  }
  if (!phone) {
    if (!optional) errors.phone = "Please enter a phone number";
  } else if (!PHONE_RE.test(phone)) {
    errors.phone = "Please enter a valid phone number";
  }
  return errors;
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function availablePackages() {
  return BOOKING_PACKAGES;
}

/** Query values from a service-page book link. Unknown ids are dropped. */
export function publicBookingSelection(query = {}) {
  const service = typeof query?.service === "string" ? query.service : "";
  const packageId = typeof query?.package === "string" ? query.package : "";
  return {
    service: BOOKING_SERVICES.some((item) => item.id === service) ? service : "",
    packageId: BOOKING_PACKAGES.some((item) => item.id === packageId) ? packageId : "",
  };
}

/** Homepage booking form with a package already selected. */
export function bookingHref(service, packageId) {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  if (packageId) params.set("package", packageId);
  const query = params.toString();
  return `/${query ? `?${query}` : ""}#booking`;
}

const PRICE_SUFFIX_BY_BILLING = {
  structure: " per structure",
  visit: "/visit",
  month: "/mo",
};

/** Unit after the dollar amount. Empty for project prices and quote packages. */
export function packagePriceSuffix(pkgOrId) {
  const pkg = typeof pkgOrId === "string"
    ? BOOKING_PACKAGES.find((item) => item.id === pkgOrId)
    : pkgOrId;
  if (!pkg || pkg.quote) return "";
  return PRICE_SUFFIX_BY_BILLING[pkg.billing] || "";
}

export function packageMenuLabel(pkg, discounted) {
  const from = pkg.quote ? "from " : "";
  const suffix = packagePriceSuffix(pkg);
  const list = formatReferralDollars(pkg.basePrice);
  if (discounted != null && discounted < pkg.basePrice) {
    return `${pkg.name} - ${from}$${formatReferralDollars(discounted)}${suffix} (was $${list}${suffix})`;
  }
  return `${pkg.name} - ${from}$${list}${suffix}`;
}

/** Fixed project price, or the from-price minimum for a quote package. */
export function estimatedPriceForPackage(packageId) {
  const current = BOOKING_PACKAGES.find((pkg) => pkg.id === packageId);
  if (current) return current.basePrice;
  if (Object.prototype.hasOwnProperty.call(LEGACY_PACKAGE_PRICES, packageId)) {
    return LEGACY_PACKAGE_PRICES[packageId];
  }
  return null;
}

/** Current package name, or a readable label for an older row. */
export function packageLabel(packageId) {
  if (!packageId) return "";
  const current = BOOKING_PACKAGES.find((pkg) => pkg.id === packageId);
  if (current) return current.name;
  if (LEGACY_PACKAGE_LABELS[packageId]) return LEGACY_PACKAGE_LABELS[packageId];
  return String(packageId)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isQuotePackage(packageId) {
  return BOOKING_PACKAGES.some((pkg) => pkg.id === packageId && pkg.quote);
}

/** Dollar amount for a booking. Quote packages say "from" until a final price is set. */
export function formatBookingPrice(packageId, estimatedPrice, finalPrice) {
  const hasFinal = finalPrice != null && finalPrice !== "";
  const amount = hasFinal ? finalPrice : estimatedPrice;
  if (amount == null || amount === "") return "";
  const from = !hasFinal && isQuotePackage(packageId) ? "from " : "";
  const numeric = Number(amount);
  const shown = Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : String(amount);
  // A typed final price is the amount charged for that booking, so the catalog unit stays off it.
  const suffix = hasFinal ? "" : packagePriceSuffix(packageId);
  return `${from}$${shown}${suffix}`;
}

export function minBookingDateTime(now = Date.now()) {
  return new Date(now + TWO_DAYS_MS).toISOString().slice(0, 16);
}

export function isValidBookingDate(value, now = Date.now()) {
  if (!value) return false;
  const selected = new Date(value);
  if (Number.isNaN(selected.getTime())) return false;
  return selected.getTime() >= now + TWO_DAYS_MS;
}

/** Zeitview (and any future non-customer source) is a mission. Manual is not. */
export function isMissionSource(source) {
  return Boolean(source && source !== "customer" && source !== MANUAL_SOURCE);
}

const GIG_SOURCE_LABELS = {
  zeitview: "Zeitview",
  flyguys: "FlyGuys",
  droners: "Droners.io",
};

export function bookingSourceLabel(source) {
  if (source === MANUAL_SOURCE) return MANUAL_SOURCE_LABEL;
  if (!source || source === "customer") return "Customer";
  if (GIG_SOURCE_LABELS[source]) return GIG_SOURCE_LABELS[source];
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function jobIsMission(job) {
  if (!job) return false;
  if (job.unlinkedListing) return true;
  if (job.source) return isMissionSource(job.source);
  return Boolean(job.isMission);
}

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
}

export function validateManualBooking(input, now = Date.now()) {
  const errors = {};
  const rawLine = stripTags(input?.serviceLine);
  const serviceLine = rawLine || DEFAULT_SERVICE_LINE;
  const isDrone = serviceLine === DEFAULT_SERVICE_LINE;
  const service = isDrone ? stripTags(input?.service) : serviceLine;
  const packageId = stripTags(input?.package);
  const date = String(input?.date ?? "").trim();
  const location = isDrone ? stripTags(input?.location) : (stripTags(input?.location) || REMOTE_LOCATION);
  const details = stripTags(input?.details);
  const name = stripTags(input?.name);
  const email = stripTags(input?.email).toLowerCase();
  const phone = stripTags(input?.phone);
  const status = stripTags(input?.status || "pending");
  const adminNotes = stripTags(input?.adminNotes ?? input?.admin_notes ?? "");
  const rawPrice = input?.finalPrice ?? input?.final_price;

  if (!isServiceLine(serviceLine)) {
    errors.serviceLine = "Please choose a business line";
  } else if (isDrone && !BOOKING_SERVICES.some((item) => item.id === service)) {
    errors.service = "Please select a service";
  }
  if (!isDrone && packageId) {
    errors.package = "Packages apply to drone bookings only";
  } else if (packageId && !availablePackages(service).some((pkg) => pkg.id === packageId)) {
    errors.package = "Please select a valid package for this service";
  }
  if (!date) {
    errors.date = "Please select a date and time";
  } else if (!isValidBookingDate(date, now)) {
    errors.date = "Please select a date that is at least 2 days from today";
  }
  Object.assign(errors, validateContactFields({
    location,
    email,
    phone,
    optional: contactOptional(status),
  }));
  if (details.length > 1000) {
    errors.details = "Details must be 1000 characters or fewer";
  }
  if (!name) {
    errors.name = "Please enter your name";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer";
  }
  if (!BOOKING_STATUSES.some((item) => item.value === status)) {
    errors.status = "Please select a status";
  }
  if (adminNotes.length > 500) {
    errors.adminNotes = "Admin notes must be 500 characters or fewer";
  }

  let finalPrice = null;
  if (rawPrice !== undefined && rawPrice !== null && String(rawPrice).trim() !== "") {
    const parsed = Number(rawPrice);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.finalPrice = "Final price must be zero or more";
    } else {
      finalPrice = parsed;
    }
  }

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          source: MANUAL_SOURCE,
          serviceLine,
          service,
          package: packageId || null,
          date: new Date(date).toISOString(),
          location: location || null,
          details,
          name,
          email: email || null,
          phone: phone || null,
          status,
          finalPrice,
          adminNotes,
        }
      : null,
  };
}
