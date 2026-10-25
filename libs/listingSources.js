// Helpers for showing mission listings from every gig source
// (Zeitview, FlyGuys texts, Droners). Pure functions so they can be tested.

export const SOURCES = [
  { value: "zeitview", label: "Zeitview" },
  { value: "flyguys", label: "FlyGuys" },
  { value: "droners", label: "Droners" },
];

export const SOURCE_FILTERS = [{ value: "", label: "All" }, ...SOURCES];

export const SOURCE_BADGE_STYLES = {
  zeitview: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200",
  flyguys: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
  droners: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-200",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

export function normalizeSource(source) {
  return String(source || "").trim().toLowerCase();
}

export function sourceLabel(source) {
  const key = normalizeSource(source);
  if (!key) return "Unknown";
  const known = SOURCES.find((item) => item.value === key);
  if (known) return known.label;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function sourceBadgeClass(source) {
  return SOURCE_BADGE_STYLES[normalizeSource(source)] || SOURCE_BADGE_STYLES.other;
}

// Counts per source for the filter chips. "All" is the sum.
export function sourceCounts(bySource = {}) {
  const counts = { "": 0 };
  for (const { value } of SOURCES) counts[value] = 0;
  for (const [key, count] of Object.entries(bySource || {})) {
    const n = Number(count) || 0;
    const k = normalizeSource(key);
    counts[k] = (counts[k] || 0) + n;
    counts[""] += n;
  }
  return counts;
}

export function isSmsListing(listing) {
  return /^sms:/i.test(String(listing?.externalMissionId || ""));
}

// The raw message for text or email based listings, trimmed.
export function listingMessageText(listing) {
  const detail = listing?.rawDetail || {};
  const candidates = [
    listing?.messageText,
    listing?.rawEmailText,
    detail.body,
    detail.text,
    detail.message,
    Array.isArray(detail.messages) ? detail.messages.map((m) => m?.body || m?.text || "").filter(Boolean).join("\n\n") : "",
  ];
  for (const value of candidates) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export function messagePreview(listing, max = 140) {
  const text = listingMessageText(listing).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

// True when the row has none of the structured fields a Zeitview page gives us,
// so the page should lead with the message text instead of blank fields.
export function isSparseListing(listing) {
  if (!listing) return false;
  const has = (list) => Array.isArray(list) && list.length > 0;
  return listing.payout == null
    && !String(listing.address || "").trim()
    && !has(listing.requiredEquipment)
    && !has(listing.requiredCertifications)
    && !has(listing.deliverables)
    && !has(listing.flightPlan);
}

// When the listing reached us (for texts this is the received time).
export function receivedAt(listing) {
  const detail = listing?.rawDetail || {};
  return detail.twilio?.receivedAt || detail.receivedAt || listing?.firstSeenAt || listing?.createdAt || null;
}

// Link to the source's mission page. Zeitview links only for Zeitview rows.
export function missionPageUrl(listing) {
  if (!listing) return null;
  const detail = listing.rawDetail || {};
  const url = listing.missionUrl || detail.url || detail.mission_url || detail.missionLink || detail.parsed?.missionLink || null;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const isZeitviewUrl = /zeitview\.com/i.test(url);
  if (isZeitviewUrl && normalizeSource(listing.source) !== "zeitview") return null;
  return url;
}
