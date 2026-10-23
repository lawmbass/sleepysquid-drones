/**
 * Validates contact edits (location, email, phone) sent to the admin booking
 * PATCH route. Blank values clear the field. Manual bookings must have all
 * contact details before leaving Pending.
 */

import { contactOptional, validateContactFields } from "./manualBooking.js";
import { normalizeServiceLine } from "./serviceLines.js";

function clean(value) {
  if (value === null) return "";
  if (typeof value !== "string") return undefined;
  return value.replace(/<[^>]*>/g, "").trim();
}

export function validateContactPatch(body = {}, existing = {}) {
  const updates = {};
  const errors = {};
  for (const key of ["location", "email", "phone"]) {
    if (body[key] === undefined) continue;
    const value = clean(body[key]);
    if (value === undefined) {
      errors[key] = `${key} must be a string`;
      continue;
    }
    updates[key] = value || null;
  }
  if (Object.keys(errors).length) return { errors, updates: {} };

  const isDrone = normalizeServiceLine(existing.serviceLine) === "drones";
  const merged = {
    location: updates.location !== undefined ? updates.location : existing.location,
    email: updates.email !== undefined ? updates.email : existing.email,
    phone: updates.phone !== undefined ? updates.phone : existing.phone,
  };
  const status = body.status !== undefined ? body.status : existing.status;
  const optional = existing.source !== "manual" || contactOptional(status);
  const formatErrors = validateContactFields({
    location: merged.location || "",
    email: merged.email || "",
    phone: merged.phone || "",
    optional,
    requireLocation: isDrone,
  });
  // Only report problems with fields being changed, or required ones still missing.
  for (const [key, message] of Object.entries(formatErrors)) {
    if (updates[key] !== undefined || !merged[key]) errors[key] = message;
  }
  if (Object.keys(errors).length) return { errors, updates: {} };

  if (updates.email) updates.email = updates.email.toLowerCase();
  if (updates.location === null) {
    updates.latitude = null;
    updates.longitude = null;
  }
  const needsAddress = Boolean(isDrone && updates.location);
  return { errors: {}, updates, needsAddress };
}
