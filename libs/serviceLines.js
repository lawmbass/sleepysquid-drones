/**
 * SleepySquid business lines. `id` is stored on bookings.service_line and
 * matches the Stripe product metadata tag `service` on acct SleepySquid LLC.
 * (bookings.service is the older drone service type, e.g. "aerial-media".)
 * Dispatch (dispatch.sleepysquid.com) is a separate app; the hub only reads its
 * Stripe revenue via the product tag and links out to it.
 */
export const EXCLUDED_STRIPE_TAGS = [];
export const DISPATCH_URL = "https://dispatch.sleepysquid.com";

export const SERVICE_LINES = [
  { id: "drones", label: "Drones", stripeTag: "drones", chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  { id: "ai", label: "AI automation", stripeTag: "ai", chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" },
  { id: "web", label: "Website dev", stripeTag: "web", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  { id: "dispatch", label: "Dispatch", stripeTag: "dispatch", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
];

export const DEFAULT_SERVICE_LINE = "drones";
export const SERVICE_LINE_IDS = SERVICE_LINES.map((s) => s.id);

export function isServiceLine(value) {
  return SERVICE_LINE_IDS.includes(value);
}

/** Missing or unknown values are treated as drones (pre-migration rows). */
export function normalizeServiceLine(value) {
  return isServiceLine(value) ? value : DEFAULT_SERVICE_LINE;
}

export function serviceLineLabel(value) {
  return (SERVICE_LINES.find((s) => s.id === value) || SERVICE_LINES[0]).label;
}

export function serviceLineFromStripeTag(tag) {
  const found = SERVICE_LINES.find((s) => s.stripeTag === String(tag || "").toLowerCase());
  return found ? found.id : null;
}
