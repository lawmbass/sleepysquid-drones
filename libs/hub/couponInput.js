import { isServiceLine } from "../serviceLines.js";

const DURATIONS = ["once", "repeating", "forever"];

/** Validates coupon create/edit input. Services must be chosen explicitly. */
export function validateCouponInput(body, { partial = false } = {}) {
  const errors = {};
  const services = Array.isArray(body?.services) ? [...new Set(body.services)] : null;
  if (!partial || services) {
    if (!services || !services.length) errors.services = "Choose at least one service";
    else if (!services.every(isServiceLine)) errors.services = "Unknown service";
  }
  const name = String(body?.name || "").trim();
  if (!partial && !name) errors.name = "Name is required";
  if (name.length > 40) errors.name = "Name must be 40 characters or fewer";
  const value = { name: name || undefined, services: services || undefined };
  if (!partial) {
    const percent = body?.percentOff === "" || body?.percentOff == null ? null : Number(body.percentOff);
    const amount = body?.amountOff === "" || body?.amountOff == null ? null : Math.round(Number(body.amountOff) * 100);
    if ((percent == null) === (amount == null)) errors.discount = "Set a percent off or an amount off";
    if (percent != null && !(percent > 0 && percent <= 100)) errors.discount = "Percent must be 1-100";
    if (amount != null && !(amount > 0)) errors.discount = "Amount must be more than zero";
    const duration = DURATIONS.includes(body?.duration) ? body.duration : "once";
    const months = Number(body?.durationInMonths);
    if (duration === "repeating" && !(months >= 1)) errors.durationInMonths = "Months is required";
    const max = body?.maxRedemptions ? Number(body.maxRedemptions) : null;
    const code = String(body?.code || "").trim().toUpperCase();
    if (code && !/^[A-Z0-9_-]{3,40}$/.test(code)) errors.code = "Code: 3-40 letters, numbers, - or _";
    Object.assign(value, {
      percentOff: percent, amountOff: amount, duration,
      durationInMonths: duration === "repeating" ? months : undefined,
      maxRedemptions: max, code: code || undefined,
    });
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}
