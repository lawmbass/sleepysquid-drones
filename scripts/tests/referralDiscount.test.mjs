import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { invoiceDiscountsForReferral, referralDiscountDecision } from "../../libs/referralDiscount.mjs";

test("an invoice for a referred customer gets the one coupon and keeps the catalog price", async () => {
  const calls = [];
  const stripe = {
    call: async (method, path) => {
      calls.push({ method, path });
      return { id: "cus_1", email: "buyer@example.test", metadata: { referrer_code: "lawrence" } };
    },
  };
  const fetchImpl = async () => ({ ok: true, json: async () => [{ email: "lawrence@sleepysquid.com" }] });
  const discounts = await invoiceDiscountsForReferral(stripe, {
    customerId: "cus_1",
    customerEmail: "buyer@example.test",
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "service", REFERRAL_DISCOUNT_PERCENT: "10" },
    fetchImpl,
  });
  assert.deepEqual(discounts, [{ coupon: "referral_10_forever" }]);
  const self = await invoiceDiscountsForReferral(stripe, {
    customerId: "cus_1",
    customerEmail: "lawrence@sleepysquid.com",
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "service" },
    fetchImpl,
  });
  assert.equal(self, undefined);
  assert.equal(referralDiscountDecision({
    couponId: "referral_10_forever",
    percent: 10,
    referrerEmail: "lawrence@sleepysquid.com",
    customerEmail: "buyer@example.test",
    existingCouponIds: ["summer"],
  }).reason, "other_coupon");
});

test("checkout sends the coupon only when it applies, and never with promotion codes", () => {
  const source = readFileSync(new URL("../../libs/stripe.js", import.meta.url), "utf8");
  assert.match(source, /if \(decision\.apply\) sessionParams\.discounts/);
  assert.match(source, /else sessionParams\.allow_promotion_codes = true/);
  assert.match(source, /price: priceId/);
  assert.doesNotMatch(source, /allow_promotion_codes: true,\s*client_reference_id/);
});
