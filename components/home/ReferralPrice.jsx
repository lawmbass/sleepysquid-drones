import { referralPriceCopy } from "@/libs/referralPrice.mjs";

/**
 * Struck list price beside the referral price.
 * The sentence in .sr-only is the accessible name; the visual prices are hidden from assistive tech
 * so the struck number is not read twice.
 */
export default function ReferralPrice({ price, quote = false, percent = 10, size = "card" }) {
  const copy = referralPriceCopy(price, { quote, percent });
  if (!copy) return null;
  const { originalText, nowText, prefix, spoken } = copy;

  if (size === "inline") {
    return (
      <span>
        <span className="sr-only">{spoken}</span>
        <s className="text-gray-500 line-through dark:text-gray-400" aria-hidden="true">
          {prefix}${originalText}
        </s>{" "}
        <span className="font-semibold text-gray-900 dark:text-white" aria-hidden="true">
          {prefix}${nowText}
        </span>
      </span>
    );
  }

  return (
    <div>
      <span className="sr-only">{spoken}</span>
      <div>
        <s className="text-lg text-gray-500 line-through dark:text-gray-400" aria-hidden="true">
          {prefix}${originalText}
        </s>
      </div>
      <div className="whitespace-nowrap" aria-hidden="true">
        {quote ? <span className="text-lg font-medium text-gray-500 dark:text-gray-400">from </span> : null}
        <span className="text-3xl font-bold text-gray-900 dark:text-white">${nowText}</span>
        {quote ? null : <span className="text-sm text-gray-500 dark:text-gray-400"> / project</span>}
      </div>
    </div>
  );
}
