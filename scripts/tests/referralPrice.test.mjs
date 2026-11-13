import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packageMenuLabel } from "../../libs/manualBooking.js";
import {
  REFERRAL_INVOICE_NOTE,
  formatReferralDollars,
  referralDiscountedAmount,
  referralPriceCopy,
} from "../../libs/referralPrice.mjs";
import {
  activeReferrerByCode,
  resolvePublicReferralDiscount,
} from "../../libs/referrals.mjs";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_SERVICE_ROLE_KEY: "local-service",
};

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("10% off rounds to cents and shows leftover cents only", () => {
  assert.equal(referralDiscountedAmount(199), 179.1);
  assert.equal(referralDiscountedAmount(399), 359.1);
  assert.equal(referralDiscountedAmount(500), 450);
  assert.equal(referralDiscountedAmount(900), 810);
  assert.equal(formatReferralDollars(179.1), "179.10");
  assert.equal(formatReferralDollars(359.1), "359.10");
  assert.equal(formatReferralDollars(450), "450");
  assert.equal(formatReferralDollars(810), "810");
  assert.equal(referralPriceCopy(199).spoken, "Original price $199, now $179.10");
  assert.equal(referralPriceCopy(500, { quote: true }).spoken, "Original price from $500, now from $450");
  assert.equal(referralPriceCopy(900, { quote: true }).spoken, "Original price from $900, now from $810");
  // 125 cents * 90% = 112.5 cents, which rounds to 113.
  assert.equal(referralDiscountedAmount(1.25), 1.13);
  assert.equal(formatReferralDollars(1.13), "1.13");
  assert.equal(referralDiscountedAmount("nope"), null);
  assert.equal(REFERRAL_INVOICE_NOTE, "10% referral discount applied to your invoice.");
});

test("booking menu labels keep whole promo dollars and show referral cents", () => {
  const photos = { name: "Listing Photos", basePrice: 199, quote: false };
  const event = { name: "Event Aerials", basePrice: 500, quote: true };
  assert.equal(packageMenuLabel(photos, null), "Listing Photos - $199");
  assert.equal(packageMenuLabel(photos, 179), "Listing Photos - $179 (was $199)");
  assert.equal(packageMenuLabel(photos, 179.1), "Listing Photos - $179.10 (was $199)");
  assert.equal(packageMenuLabel({ name: "Listing Photos + Video", basePrice: 399, quote: false }, 359.1), "Listing Photos + Video - $359.10 (was $399)");
  assert.equal(packageMenuLabel(event, null), "Event Aerials - from $500");
  assert.equal(packageMenuLabel(event, 450), "Event Aerials - from $450 (was $500)");
  assert.equal(packageMenuLabel({ name: "Mapping & 3D", basePrice: 900, quote: true }, 810), "Mapping & 3D - from $810 (was $900)");
});

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls);
  };
  return { fetchImpl, calls };
}

function jsonResponse(rows, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => rows };
}

function row(code, extra = {}) {
  return { code, active: true, archived_at: null, deleted_at: null, ...extra };
}

test("a valid active referrer resolves from the cookie or from ?ref= on the first request", async () => {
  const { fetchImpl, calls } = mockFetch(async (url) => {
    const code = new URL(url).searchParams.get("code");
    assert.equal(code, "eq.mike4821");
    assert.match(url, /active=eq\.true/);
    assert.match(url, /archived_at=is\.null/);
    assert.match(url, /deleted_at=is\.null/);
    assert.match(url, /\/rest\/v1\/referrers\?/);
    return jsonResponse([row("mike4821")]);
  });
  const fromQuery = await resolvePublicReferralDiscount({
    req: { headers: {} },
    query: { ref: "mike4821" },
    env: ENV,
    fetchImpl,
    getPromo: async () => null,
  });
  assert.deepEqual(fromQuery, { percent: 10 });
  assert.equal(calls[0].init.headers["Accept-Profile"], "portal");
  assert.equal(calls[0].init.headers.apikey, "local-service");

  const fromCookie = await resolvePublicReferralDiscount({
    req: { headers: { cookie: "ss_ref=mike4821" } },
    query: {},
    env: ENV,
    fetchImpl,
    getPromo: async () => null,
  });
  assert.deepEqual(fromCookie, { percent: 10 });

  const cookieWins = await resolvePublicReferralDiscount({
    req: { headers: { cookie: "theme=dark; ss_ref=mike4821" }, body: { ref: "othercode1" } },
    query: { ref: "othercode1" },
    env: ENV,
    fetchImpl,
    getPromo: async () => null,
  });
  assert.deepEqual(cookieWins, { percent: 10 });
  assert.ok(calls.every((call) => call.url.includes("code=eq.mike4821")));
});

test("unknown, invalid, inactive, archived, and deleted codes show no discount", async () => {
  const { fetchImpl, calls } = mockFetch(async (url) => {
    const code = new URL(url).searchParams.get("code").slice(3);
    const table = {
      missing01: [],
      inactive1: [row("inactive1", { active: false })],
      archived1: [row("archived1", { archived_at: "2026-01-01T00:00:00Z" })],
      deleted01: [row("deleted01", { deleted_at: "2026-01-01T00:00:00Z" })],
      swapped01: [row("someoneelse")],
    };
    return jsonResponse(table[code] || []);
  });
  const options = { env: ENV, fetchImpl, getPromo: async () => null };

  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: { ref: "missing01" }, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: { ref: "inactive1" }, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: { ref: "archived1" }, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: { ref: "deleted01" }, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: { ref: "swapped01" }, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: { ref: "NOPE" }, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({ req: { headers: {} }, query: {}, ...options }), null);
  assert.equal(await resolvePublicReferralDiscount({
    req: { headers: { cookie: "ss_ref=NOPE" } },
    query: {},
    ...options,
  }), null);
  assert.ok(calls.every((call) => !call.url.includes("NOPE")));
  assert.equal(calls.length, 5);

  const down = mockFetch(async () => { throw new Error("connection refused"); });
  assert.equal(await activeReferrerByCode("mike4821", { env: ENV, fetchImpl: down.fetchImpl }), null);
  const denied = mockFetch(async () => jsonResponse({ message: "no" }, 401));
  assert.equal(await activeReferrerByCode("mike4821", { env: ENV, fetchImpl: denied.fetchImpl }), null);
  assert.equal(await activeReferrerByCode("mike4821", { env: {}, fetchImpl }), null);
});

test("a database without deleted_at still accepts an active row", async () => {
  const { fetchImpl, calls } = mockFetch(async (url) => {
    if (url.includes("deleted_at=is.null")) return jsonResponse({ message: "column deleted_at does not exist" }, 400);
    return jsonResponse([row("mike4821")]);
  });
  const offer = await resolvePublicReferralDiscount({
    req: { headers: { cookie: "ss_ref=mike4821" } },
    query: {},
    env: ENV,
    fetchImpl,
    getPromo: async () => null,
  });
  assert.deepEqual(offer, { percent: 10 });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.includes("deleted_at"), false);
});

test("an active promo suppresses the referral display and a promo lookup failure does not", async () => {
  const { fetchImpl } = mockFetch(async () => jsonResponse([row("mike4821")]));
  const base = {
    req: { headers: { cookie: "ss_ref=mike4821" } },
    query: {},
    env: ENV,
    fetchImpl,
  };
  assert.equal(await resolvePublicReferralDiscount({ ...base, getPromo: async () => ({ id: "promo-1", discountPercentage: 15 }) }), null);
  assert.deepEqual(await resolvePublicReferralDiscount({ ...base, getPromo: async () => null }), { percent: 10 });
  assert.deepEqual(await resolvePublicReferralDiscount({
    ...base,
    getPromo: async () => { throw new Error("promos unavailable"); },
  }), { percent: 10 });
});

test("the homepage resolves the referral on the server and leaves the promo strikethrough alone", () => {
  const page = read("pages/index.js");
  const pricing = read("components/home/PricingSection.jsx");
  const booking = read("components/home/BookingSection.jsx");
  const price = read("components/home/ReferralPrice.jsx");
  const promoRoute = read("pages/api/promo/active.js");
  assert.match(page, /getServerSideProps/);
  assert.match(page, /resolvePublicReferralDiscount/);
  assert.match(pricing, /ReferralPrice/);
  assert.match(pricing, /activePromo \?/);
  assert.match(pricing, /\/api\/promo\/active/);
  assert.match(pricing, /showReferral/);
  assert.match(booking, /ReferralPrice/);
  assert.match(booking, /calculateDiscountedPrice\(pkg\.basePrice\)/);
  assert.match(price, /<s /);
  assert.match(price, /sr-only/);
  assert.match(promoRoute, /getActivePromo/);
  assert.doesNotMatch(promoRoute, /referral/);
});
