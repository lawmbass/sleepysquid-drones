// One referral coupon, forever, on top of the invoice price.
// Lawrence creates the coupon. This module never creates Stripe objects.

import { referralCodeOrNull } from "./referrals.mjs";

export const REFERRAL_COUPON_ID_DEFAULT = "referral_10_forever";

export function referralCouponId(env = process.env) {
  const id = env.REFERRAL_COUPON_ID;
  if (id === undefined || String(id).trim() === "") return REFERRAL_COUPON_ID_DEFAULT;
  return String(id).trim();
}

export function referralDiscountPercent(env = process.env) {
  const raw = env.REFERRAL_DISCOUNT_PERCENT;
  if (raw === undefined || String(raw).trim() === "") return 10;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n));
}

function sameEmail(a, b) {
  const left = String(a || "").trim().toLowerCase();
  const right = String(b || "").trim().toLowerCase();
  return !!left && left === right;
}

export function customerCouponIds(customer) {
  const ids = [];
  const push = (coupon) => {
    if (!coupon) return;
    ids.push(typeof coupon === "string" ? coupon : coupon.id || "");
  };
  push(customer?.discount?.coupon);
  const list = customer?.discounts?.data || (Array.isArray(customer?.discounts) ? customer.discounts : []);
  for (const row of list) push(row?.coupon || row?.source?.coupon);
  return [...new Set(ids.filter(Boolean))];
}

export function referralDiscountDecision({ couponId, percent, referrerEmail, customerEmail, existingCouponIds } = {}) {
  const id = String(couponId || "").trim();
  const n = Number(percent);
  if (!id || !Number.isFinite(n) || n <= 0) return { apply: false, reason: "off" };
  if (sameEmail(referrerEmail, customerEmail)) return { apply: false, reason: "self" };
  const existing = (existingCouponIds || []).filter(Boolean);
  if (existing.some((coupon) => coupon !== id)) return { apply: false, reason: "other_coupon" };
  if (existing.includes(id)) return { apply: false, reason: "already" };
  return { apply: true, couponId: id, reason: "apply" };
}

async function referrerEmailForCode(code, env, fetchImpl = globalThis.fetch) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !code) return "";
  const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/referrers?code=eq.${encodeURIComponent(code)}&active=eq.true&select=email`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Profile": "portal" },
  });
  if (!response.ok) return "";
  const rows = await response.json();
  return rows?.[0]?.email || "";
}

/** Discounts for one invoice. Undefined means "do not set discounts" so another coupon on the customer is left alone. */
export async function invoiceDiscountsForReferral(stripe, { customerId, referrerCode, customerEmail, env = process.env, fetchImpl } = {}) {
  const couponId = referralCouponId(env);
  const percent = referralDiscountPercent(env);
  if (!couponId || percent <= 0 || !customerId || !stripe?.call) return undefined;
  const customer = await stripe.call("GET", `/customers/${encodeURIComponent(customerId)}`);
  const code = referralCodeOrNull(referrerCode) || referralCodeOrNull(customer?.metadata?.referrer_code);
  if (!code) return undefined;
  const referrerEmail = await referrerEmailForCode(code, env, fetchImpl).catch(() => "");
  if (!referrerEmail) return undefined;
  const decision = referralDiscountDecision({
    couponId,
    percent,
    referrerEmail,
    customerEmail: customerEmail || customer?.email,
    existingCouponIds: customerCouponIds(customer),
  });
  if (!decision.apply) return undefined;
  return [{ coupon: decision.couponId }];
}
