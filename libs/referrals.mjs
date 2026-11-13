/**
 * Referral codes arrive as ?ref=<code> (from ai.sleepysquid.com/r/<code>?to=drones).
 * The cookie stores the code only: lowercase letters, digits, and hyphens, 4–32 characters.
 * No email, name, or other personal data.
 *
 * This module is imported by Edge middleware, so it stays free of Node builtins.
 */

import { REFERRAL_DISPLAY_PERCENT } from "./referralPrice.mjs";

export const REFERRAL_COOKIE = "ss_ref";
export const REFERRAL_MAX_AGE = 60 * 60 * 24 * 30;

const REFERRAL_CODE = /^[a-z0-9-]{4,32}$/;

export function referralCodeOrNull(value) {
  if (Array.isArray(value)) return referralCodeOrNull(value[0]);
  const code = String(value ?? "").trim();
  return REFERRAL_CODE.test(code) ? code : null;
}

export function hostnameFromHost(host) {
  let value = String(host || "").split(",")[0].trim().toLowerCase();
  if (!value) return "";
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value : value.slice(1, end);
  }
  const colon = value.lastIndexOf(":");
  if (colon > -1 && /^\d+$/.test(value.slice(colon + 1))) value = value.slice(0, colon);
  return value;
}

export function isSleepySquidHost(hostname) {
  const host = hostnameFromHost(hostname);
  return host === "sleepysquid.com" || host.endsWith(".sleepysquid.com");
}

export function isLocalHost(hostname) {
  const host = hostnameFromHost(hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Domain=.sleepysquid.com on the apex and any subdomain so the cookie matches
 * the one set by ai.sleepysquid.com. Localhost and every other host stay host-only.
 */
export function referralCookieDomain(host) {
  const hostname = hostnameFromHost(host);
  if (!hostname || isLocalHost(hostname)) return null;
  if (isSleepySquidHost(hostname)) return ".sleepysquid.com";
  return null;
}

/** Prefer a public SleepySquid host when a proxy forwards it, otherwise the request host. */
export function hostForReferralCookie(...values) {
  const hosts = values
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const sleepy = hosts.find((host) => isSleepySquidHost(host));
  if (sleepy) return sleepy;
  const local = hosts.find((host) => isLocalHost(host));
  if (local) return local;
  return hosts[0] || "";
}

export function referralCodeFromCookieHeader(header) {
  let found = null;
  for (const part of String(header || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name !== REFERRAL_COOKIE) continue;
    let value = part.slice(idx + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) value = value.slice(1, -1);
    try { value = decodeURIComponent(value); } catch { /* keep the raw token */ }
    const code = referralCodeOrNull(value);
    if (code) found = code;
  }
  return found;
}

/**
 * Set-Cookie for a new code, or null when the code is invalid or a valid ss_ref
 * is already present. Never clears or replaces an existing valid code.
 */
export function referralSetCookieHeader({ ref, cookieHeader, host } = {}) {
  const code = referralCodeOrNull(ref);
  if (!code) return null;
  if (referralCodeFromCookieHeader(cookieHeader)) return null;
  const parts = [
    `${REFERRAL_COOKIE}=${code}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${REFERRAL_MAX_AGE}`,
  ];
  const domain = referralCookieDomain(host);
  if (domain) parts.push(`Domain=${domain}`);
  return parts.join("; ");
}

/** Cookie wins over a posted or query ref so a later form cannot replace the first code. */
export function referralCodeFromRequest(req) {
  const fromCookie = referralCodeFromCookieHeader(req?.headers?.cookie)
    || referralCodeOrNull(req?.cookies?.[REFERRAL_COOKIE]);
  if (fromCookie) return fromCookie;
  return referralCodeOrNull(req?.body?.ref) || referralCodeOrNull(req?.query?.ref);
}

/** Keep a stored code. A new valid code is written only when nothing valid is stored yet. */
export function preferencesWithReferral(existing, code) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const stored = referralCodeOrNull(base.referrerCode);
  if (stored) return { ...base, referrerCode: stored };
  const next = referralCodeOrNull(code);
  if (!next) return existing || undefined;
  return { ...base, referrerCode: next };
}

/** Settings responses omit the code so the preferences form does not round-trip it away. */
export function preferencesForClient(preferences) {
  const copy = { ...(preferences || {}) };
  delete copy.referrerCode;
  return copy;
}

/**
 * Stripe metadata change for referrer_code. Null means "do not write":
 * no code, or the customer already has one. The patch contains only the new key
 * so a customer update merges and leaves every other metadata key alone.
 */
export function metadataPatchForReferrer(existingMetadata, referrerCode) {
  const code = referralCodeOrNull(referrerCode);
  if (!code) return null;
  if (String(existingMetadata?.referrer_code || "").trim()) return null;
  return { referrer_code: code };
}

/**
 * Checkout customer assignment. Creates a customer only when a referral code is
 * present and Checkout would otherwise create one. Reuses an existing customer
 * and fills referrer_code when that field is empty. Does not create products,
 * prices, or transfers. `stripe` is an injected client (tests pass a mock).
 */
export async function applyReferralToCheckoutCustomer(stripe, { user, referrerCode } = {}) {
  const code = referralCodeOrNull(referrerCode);
  if (user?.customerId) {
    if (!code || !stripe?.customers?.retrieve) return { customerId: user.customerId, created: false };
    const existing = await stripe.customers.retrieve(user.customerId);
    if (existing?.deleted) return { customerId: null, created: false };
    const patch = metadataPatchForReferrer(existing?.metadata, code);
    if (patch) await stripe.customers.update(user.customerId, { metadata: patch });
    return { customerId: user.customerId, created: false };
  }
  if (!code) return null;
  const created = await stripe.customers.create({
    email: user?.email || undefined,
    name: user?.name || undefined,
    metadata: { referrer_code: code },
  });
  return { customerId: created.id, created: true };
}

/**
 * Active portal.referrers row (PostgREST: /rest/v1/referrers with Accept-Profile: portal).
 * Unknown, inactive, archived, or deleted codes return null. Any lookup error returns null.
 */
export async function activeReferrerByCode(code, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const clean = referralCodeOrNull(code);
  if (!clean) return null;
  const url = env?.NEXT_PUBLIC_SUPABASE_URL || env?.SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || typeof fetchImpl !== "function") return null;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Accept-Profile": "portal",
  };
  const base = `${String(url).replace(/\/$/, "")}/rest/v1/referrers?code=eq.${encodeURIComponent(clean)}&active=eq.true&archived_at=is.null`;
  let response;
  try {
    response = await fetchImpl(`${base}&deleted_at=is.null&select=code,active,archived_at,deleted_at`, {
      headers,
      cache: "no-store",
    });
    // portal_017 adds deleted_at. A database that does not have the column yet answers 400.
    if (response?.status === 400) {
      response = await fetchImpl(`${base}&select=code,active,archived_at`, { headers, cache: "no-store" });
    }
  } catch {
    return null;
  }
  if (!response?.ok) return null;
  let rows;
  try {
    rows = await response.json();
  } catch {
    return null;
  }
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.active !== true || row.archived_at || row.deleted_at) return null;
  if (referralCodeOrNull(row.code) !== clean) return null;
  return { code: clean };
}

/** Display offer for one active code. The client receives the percent only, never the referrer row. */
export async function publicReferralOffer(code, options) {
  const row = await activeReferrerByCode(code, options);
  if (!row) return null;
  return { percent: REFERRAL_DISPLAY_PERCENT };
}

/**
 * Homepage discount. Cookie wins over ?ref=, matching the code invoicing will use.
 * A promo that is already active suppresses the referral display so the two strikethroughs do not stack.
 * A promo lookup failure leaves the referral visible; the promo banner still replaces it if that request succeeds.
 */
export async function resolvePublicReferralDiscount({ req, query, env, fetchImpl, getPromo } = {}) {
  const code = referralCodeFromRequest({
    headers: req?.headers,
    cookies: req?.cookies,
    query: query || req?.query,
    body: req?.body,
  });
  if (!code) return null;
  const offer = await publicReferralOffer(code, { env, fetchImpl });
  if (!offer) return null;
  let promo = null;
  try {
    promo = typeof getPromo === "function" ? await getPromo() : null;
  } catch {
    promo = null;
  }
  if (promo) return null;
  return { percent: offer.percent };
}
