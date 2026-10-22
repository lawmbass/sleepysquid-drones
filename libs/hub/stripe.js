/**
 * Server-only Stripe reads for the client hub (SleepySquid LLC account).
 * Uses STRIPE_HUB_SECRET_KEY (a restricted read key is enough) or falls back
 * to STRIPE_SECRET_KEY. Never import this from a component.
 *
 * Service tags: products carry metadata.service = drones | ai | web. Products
 * with any other tag are skipped entirely.
 */
import { EXCLUDED_STRIPE_TAGS, SERVICE_LINES, serviceLineFromStripeTag } from "../serviceLines.js";

const API = "https://api.stripe.com/v1";

function stripeKey() {
  return process.env.STRIPE_HUB_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
}

export function stripeConfigured() {
  return Boolean(stripeKey());
}

/** Coupon create/edit only runs with a Stripe test-mode key. Live writes are blocked in code. */
export function stripeWritesAllowed() {
  const key = stripeKey();
  return /^(sk|rk)_test_/.test(key);
}

export class StripeHubError extends Error {}

function encode(params, prefix = "", out = []) {
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === "object") encode(item, `${name}[${index}]`, out);
        else out.push(`${encodeURIComponent(`${name}[]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof value === "object") {
      encode(value, name, out);
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
    }
  }
  return out;
}

async function request(method, path, params) {
  const key = stripeKey();
  if (!key) throw new StripeHubError("Stripe is not configured");
  const query = encode(params).join("&");
  const url = method === "GET" && query ? `${API}${path}?${query}` : `${API}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(method === "GET" ? {} : { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body: method === "GET" ? undefined : query,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Log the Stripe error type only; clients get a generic message.
    console.error("Stripe hub request failed", path, response.status, body?.error?.type);
    throw new StripeHubError("Stripe request failed");
  }
  return body;
}

export const stripeGet = (path, params) => request("GET", path, params);

async function writeRequest(method, path, params) {
  if (!stripeWritesAllowed()) throw new StripeHubError("Stripe writes are disabled outside test mode");
  return request(method, path, params);
}

export async function listAll(path, params = {}, max = 2000) {
  const rows = [];
  let startingAfter;
  for (;;) {
    const page = await stripeGet(path, { limit: 100, ...params, starting_after: startingAfter });
    rows.push(...(page.data || []));
    if (!page.has_more || rows.length >= max || !page.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return rows;
}

/** productId -> { serviceLine, name } for products with a known service tag. */
export async function productServiceMap() {
  const products = await listAll("/products", {});
  const map = {};
  for (const product of products) {
    if (EXCLUDED_STRIPE_TAGS.includes(String(product.metadata?.service || "").toLowerCase())) {
      map[product.id] = { excluded: true };
      continue;
    }
    const line = serviceLineFromStripeTag(product.metadata?.service);
    if (line) map[product.id] = { serviceLine: line, name: product.name, active: product.active };
  }
  return map;
}

function lineProductId(line) {
  const product = line?.price?.product ?? line?.pricing?.price_details?.product ?? line?.plan?.product;
  return typeof product === "string" ? product : product?.id || null;
}

function emptyByService() {
  return Object.fromEntries(SERVICE_LINES.map((s) => [s.id, 0]));
}

/**
 * Paid revenue per service line from paid invoices since `sinceUnix`.
 * Amounts are in cents. Lines without a tagged product go to `untagged`.
 */
export async function revenueByService(sinceUnix, products) {
  const invoices = await listAll("/invoices", { status: "paid", "created[gte]": sinceUnix });
  const totals = emptyByService();
  const counts = emptyByService();
  let untagged = 0;
  let currency = "usd";
  for (const invoice of invoices) {
    currency = invoice.currency || currency;
    let lines = invoice.lines?.data || [];
    if (invoice.lines?.has_more) {
      lines = await listAll(`/invoices/${invoice.id}/lines`, {});
    }
    const seen = new Set();
    for (const line of lines) {
      const tagged = products[lineProductId(line)];
      if (tagged?.excluded) continue;
      if (tagged) {
        totals[tagged.serviceLine] += line.amount || 0;
        seen.add(tagged.serviceLine);
      } else {
        untagged += line.amount || 0;
      }
    }
    seen.forEach((id) => { counts[id] += 1; });
  }
  return { totals, invoiceCounts: counts, untagged, currency, invoiceCount: invoices.length };
}

/** Distinct customers with an active or trialing subscription, per service line. */
export async function activeSubscribersByService(products) {
  const subs = [
    ...(await listAll("/subscriptions", { status: "active" })),
    ...(await listAll("/subscriptions", { status: "trialing" })),
  ];
  const customers = Object.fromEntries(SERVICE_LINES.map((s) => [s.id, new Set()]));
  for (const sub of subs) {
    for (const item of sub.items?.data || []) {
      const tagged = products[lineProductId(item)];
      if (tagged && !tagged.excluded) customers[tagged.serviceLine].add(typeof sub.customer === "string" ? sub.customer : sub.customer?.id);
    }
  }
  return customers;
}

/* ---------------- Coupons ---------------- */

export async function listCouponsWithServices() {
  const [products, coupons, promotionCodes] = await Promise.all([
    productServiceMap(),
    listAll("/coupons", { "expand[]": "data.applies_to" }),
    listAll("/promotion_codes", {}),
  ]);
  const excludedTag = (c) => EXCLUDED_STRIPE_TAGS.includes(String(c.metadata?.service || "").toLowerCase());
  const onlyExcluded = (c) => {
    const ids = c.applies_to?.products || [];
    return ids.length > 0 && ids.every((id) => products[id]?.excluded);
  };
  return coupons.filter((c) => !excludedTag(c) && !onlyExcluded(c)).map((coupon) => {
    const appliesTo = coupon.applies_to?.products || [];
    let services = [...new Set(appliesTo.map((id) => products[id]?.serviceLine).filter(Boolean))];
    let restricted = appliesTo.length > 0;
    if (!services.length) {
      const tagged = String(coupon.metadata?.services || coupon.metadata?.service || "")
        .split(",").map((t) => serviceLineFromStripeTag(t.trim())).filter(Boolean);
      services = [...new Set(tagged)];
    }
    return {
      id: coupon.id,
      name: coupon.name || coupon.id,
      percentOff: coupon.percent_off,
      amountOff: coupon.amount_off,
      currency: coupon.currency,
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months,
      maxRedemptions: coupon.max_redemptions,
      timesRedeemed: coupon.times_redeemed,
      redeemBy: coupon.redeem_by,
      valid: coupon.valid,
      services,
      // false = Stripe applies it to every product; services come from metadata only.
      enforcedInStripe: restricted,
      codes: promotionCodes
        .filter((code) => (code.coupon?.id || code.coupon || code.promotion?.coupon) === coupon.id)
        .map((code) => ({ id: code.id, code: code.code, active: code.active, timesRedeemed: code.times_redeemed })),
    };
  });
}

function productsForServices(products, services) {
  return Object.entries(products)
    
    .filter(([, info]) => !info.excluded && info.active !== false && services.includes(info.serviceLine))
    .map(([id]) => id);
}

/**
 * Create a coupon limited to the chosen services' products (applies_to.products).
 * Test mode only.
 */
export async function createServiceCoupon(input) {
  if (!stripeWritesAllowed()) throw new StripeHubError("Stripe writes are disabled outside test mode");
  const products = await productServiceMap();
  const productIds = productsForServices(products, input.services);
  if (!productIds.length) throw new StripeHubError("No Stripe products are tagged for those services");
  const coupon = await writeRequest("POST", "/coupons", {
    name: input.name,
    percent_off: input.percentOff ?? undefined,
    amount_off: input.amountOff ?? undefined,
    currency: input.amountOff ? (input.currency || "usd") : undefined,
    duration: input.duration,
    duration_in_months: input.duration === "repeating" ? input.durationInMonths : undefined,
    max_redemptions: input.maxRedemptions ?? undefined,
    applies_to: { products: productIds },
    metadata: { services: input.services.join(",") },
  });
  if (input.code) {
    await writeRequest("POST", "/promotion_codes", { coupon: coupon.id, code: input.code });
  }
  return coupon;
}

/**
 * Edit a coupon. Stripe only lets name and metadata change after creation, and
 * applies_to is fixed. Changing services therefore RECREATES the coupon:
 *   1. create a new coupon with the same terms and the new applies_to,
 *   2. deactivate each active promotion code on the old coupon and recreate the
 *      same code on the new one,
 *   3. delete the old coupon (existing customer discounts keep working; Stripe
 *      only stops new redemptions).
 * Test mode only.
 */
export async function updateServiceCoupon(id, input) {
  if (!stripeWritesAllowed()) throw new StripeHubError("Stripe writes are disabled outside test mode");
  const existing = (await listCouponsWithServices()).find((c) => c.id === id);
  if (!existing) throw new StripeHubError("Coupon not found");
  const sameServices = input.services
    && existing.enforcedInStripe
    && [...input.services].sort().join(",") === [...existing.services].sort().join(",");

  if (!input.services || sameServices) {
    return writeRequest("POST", `/coupons/${id}`, { name: input.name || existing.name });
  }

  const created = await createServiceCoupon({
    name: input.name || existing.name,
    percentOff: existing.percentOff,
    amountOff: existing.amountOff,
    currency: existing.currency,
    duration: existing.duration,
    durationInMonths: existing.durationInMonths,
    maxRedemptions: existing.maxRedemptions,
    services: input.services,
  });
  for (const code of existing.codes.filter((c) => c.active)) {
    await writeRequest("POST", `/promotion_codes/${code.id}`, { active: false });
    await writeRequest("POST", "/promotion_codes", { coupon: created.id, code: code.code });
  }
  await writeRequest("DELETE", `/coupons/${id}`, {});
  return { ...created, replaced: id };
}
