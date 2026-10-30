/**
 * Builds the DroneBase pilot email for a cancel request.
 * The drone-gigs bot sends it (see cancelEmail.js); the draft links are the fallback.
 */

import { gigCardState, listingSchedule } from "./jobs.js";
import { bookingWorkComplete, listingWorkComplete } from "./gigComplete.js";

export { bookingWorkComplete, listingWorkComplete };

export function cancelGigVisibility(args = {}) {
  return gigCardState(args);
}

export const PILOT_EMAIL = "pilots@dronebase.com";
export const GMAIL_ACCOUNT = "lawmbass1@gmail.com";
export const PILOT_NAME = "Lawrence Bass";

export function formatScheduleEt(schedule) {
  if (!schedule?.date) return "Not listed";
  const date = new Date(schedule.date);
  if (Number.isNaN(date.getTime())) return "Not listed";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.wallClock ? "UTC" : "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted} ET`;
}

export function flightWarning(schedule, now = new Date()) {
  if (!schedule?.date) return { level: "unknown", hoursUntil: null };
  const flightMs = new Date(schedule.date).getTime();
  if (Number.isNaN(flightMs)) return { level: "unknown", hoursUntil: null };
  const hoursUntil = (flightMs - new Date(now).getTime()) / 3600000;
  if (hoursUntil < 0) return { level: "past", hoursUntil };
  if (hoursUntil < 24) return { level: "soon", hoursUntil };
  return { level: "ok", hoursUntil };
}

export function flightWarningMessage(level) {
  if (level === "past") {
    return "This flight time is already past. Zeitview has no cancel button, and a late notice can affect your standing. Send the email only if you still need them to close the mission.";
  }
  if (level === "soon") {
    return "This flight is less than 24 hours away. Zeitview has no cancel button, and cancelling this close to the flight time can affect your standing.";
  }
  if (level === "unknown") {
    return "No flight time was stored, so this could not be checked against the 24 hour window.";
  }
  return "";
}

export function buildCancelDraft({ missionId, address, schedule, reason }) {
  const id = String(missionId || "").trim() || "unknown mission";
  const place = String(address || "").trim() || "address not listed";
  const subject = `Cancel mission ${id} – ${place}`;
  const ask = "Could you cancel this mission?";
  const body = [
    "Hi,",
    "",
    ask,
    "",
    `Mission: ${id}`,
    `Address: ${place}`,
    `Scheduled: ${formatScheduleEt(schedule)}`,
    `Reason: ${String(reason || "").trim()}`,
    "",
    `Thanks, ${PILOT_NAME}`,
  ].join("\n");
  return {
    to: PILOT_EMAIL,
    subject,
    body,
    fromAccount: GMAIL_ACCOUNT,
  };
}

function queryString(params) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function gmailComposeUrl(draft) {
  const query = queryString({
    authuser: GMAIL_ACCOUNT,
    view: "cm",
    fs: "1",
    to: draft.to,
    su: draft.subject,
    body: draft.body,
  });
  return `https://mail.google.com/mail/?${query}`;
}

export function mailtoUrl(draft) {
  return `mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}

export function scheduleForListing(listing) {
  return listingSchedule(listing);
}
