// Public referral prices. 10% off, rounded to the nearest cent.
// The invoice still uses the catalog price; referral_10_forever is applied when the invoice is created.

export const REFERRAL_DISPLAY_PERCENT = 10;
export const REFERRAL_INVOICE_NOTE = "10% referral discount applied to your invoice.";

/** Dollar amount after a percent discount, rounded to cents. Null when the price is not a number. */
export function referralDiscountedAmount(price, percent = REFERRAL_DISPLAY_PERCENT) {
  const cents = Math.round(Number(price) * 100);
  const rate = Number(percent);
  if (!Number.isFinite(cents) || !Number.isFinite(rate) || rate <= 0 || rate > 100) return null;
  return Math.round((cents * (100 - rate)) / 100) / 100;
}

/** Whole dollars stay whole ($450). Any leftover cents show two digits ($179.10). */
export function formatReferralDollars(amount) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

export function referralPriceCopy(price, { quote = false, percent = REFERRAL_DISPLAY_PERCENT } = {}) {
  const discounted = referralDiscountedAmount(price, percent);
  if (discounted == null) return null;
  const originalText = formatReferralDollars(price);
  const nowText = formatReferralDollars(discounted);
  const prefix = quote ? "from " : "";
  return {
    discounted,
    originalText,
    nowText,
    prefix,
    spoken: `Original price ${prefix}$${originalText}, now ${prefix}$${nowText}`,
  };
}
