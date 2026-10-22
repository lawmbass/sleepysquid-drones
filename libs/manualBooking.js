/**
 * Admin "Add booking" rules. Matches the public form's service list,
 * package rules, and date/email checks. Source is "manual" because
 * bookings_source_check allows customer, zeitview, and manual.
 */

import { DEFAULT_SERVICE_LINE, isServiceLine } from "./serviceLines.js";

export const MANUAL_SOURCE = "manual";
/** Location stored for non-drone bookings (bookings.location is NOT NULL). */
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

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function availablePackages() {
  return BOOKING_PACKAGES;
}

export function packageMenuLabel(pkg, discounted) {
  const from = pkg.quote ? "from " : "";
  if (discounted != null && discounted < pkg.basePrice) {
    return `${pkg.name} - ${from}$${discounted} (was $${pkg.basePrice})`;
  }
  return `${pkg.name} - ${from}$${pkg.basePrice}`;
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
  return `${from}$${shown}`;
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

export function bookingSourceLabel(source) {
  if (source === MANUAL_SOURCE) return MANUAL_SOURCE_LABEL;
  if (!source || source === "customer") return "Customer";
  if (source === "zeitview") return "Zeitview";
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
  if (!location) {
    errors.location = "Please enter a location";
  } else if (location.length > 200) {
    errors.location = "Location must be 200 characters or fewer";
  }
  if (details.length > 1000) {
    errors.details = "Details must be 1000 characters or fewer";
  }
  if (!name) {
    errors.name = "Please enter your name";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer";
  }
  if (!email) {
    errors.email = "Please enter your email";
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    errors.email = "Please enter a valid email";
  }
  if (!phone) {
    errors.phone = "Please enter your phone number";
  } else if (!/^[+]?[\d\s\-()]{10,}$/.test(phone)) {
    errors.phone = "Please enter a valid phone number";
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
          location,
          details,
          name,
          email,
          phone,
          status,
          finalPrice,
          adminNotes,
        }
      : null,
  };
}
