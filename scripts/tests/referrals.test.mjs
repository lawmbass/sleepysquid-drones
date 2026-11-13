import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REFERRAL_COOKIE,
  applyReferralToCheckoutCustomer,
  hostForReferralCookie,
  metadataPatchForReferrer,
  preferencesForClient,
  preferencesWithReferral,
  referralCodeFromCookieHeader,
  referralCodeFromRequest,
  referralCodeOrNull,
  referralCookieDomain,
  referralSetCookieHeader,
} from "../../libs/referrals.mjs";
import { currentReferralCode, runWithReferralCode } from "../../libs/referralContext.mjs";
import {
  createStripeClient,
  ensureCustomer,
  ensureCustomerByEmail,
  stampReferralFromRequest,
} from "../../libs/invoicing/stripeInvoices.mjs";

const COOKIE = "ss_ref=mike4821; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000";
const SHARED = `${COOKIE}; Domain=.sleepysquid.com`;

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("?ref= stores only a valid code, with the shared domain on sleepysquid hosts", () => {
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "drones.sleepysquid.com" }), SHARED);
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "drones.sleepysquid.com:443" }), SHARED);
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "sleepysquid.com" }), SHARED);
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "ai.sleepysquid.com" }), SHARED);
  assert.equal(referralSetCookieHeader({ ref: "ab-1", host: "www.sleepysquid.com" }), SHARED.replace("mike4821", "ab-1"));
  assert.equal(referralCookieDomain("drones.sleepysquid.com"), ".sleepysquid.com");
  assert.equal(hostForReferralCookie("internal.local", "drones.sleepysquid.com"), "drones.sleepysquid.com");
  const header = referralSetCookieHeader({ ref: "mike4821", host: "drones.sleepysquid.com" });
  assert.equal(header.split(";")[0], "ss_ref=mike4821");
  assert.equal(header.includes("@"), false);
  assert.equal(header.includes("mike@"), false);
  assert.equal(REFERRAL_COOKIE, "ss_ref");
});

test("localhost and other hosts omit Domain; invalid codes and a kept cookie set nothing", () => {
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "localhost:3456" }), COOKIE);
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "127.0.0.1:3456" }), COOKIE);
  assert.equal(referralCookieDomain("localhost"), null);
  assert.equal(referralCookieDomain("127.0.0.1"), null);
  assert.equal(referralSetCookieHeader({ ref: "mike4821", host: "sleepysquid-drones.vercel.app" }).includes("Domain="), false);
  assert.equal(referralCookieDomain("notsleepysquid.com"), null);
  assert.equal(referralCookieDomain("sleepysquid.com.evil.com"), null);

  for (const ref of ["", "ab", "abc", "a".repeat(33), "Mike4821", "mike_4821", "mike.4821", "mike@example.com", "mike 4821", "NOPE", null, undefined]) {
    assert.equal(referralCodeOrNull(ref), null, `rejected ${ref}`);
    assert.equal(referralSetCookieHeader({ ref, host: "drones.sleepysquid.com" }), null);
  }
  assert.equal(referralCodeOrNull("  mike4821  "), "mike4821");

  assert.equal(referralSetCookieHeader({
    ref: "newcode1",
    cookieHeader: "theme=dark; ss_ref=mike4821; other=1",
    host: "drones.sleepysquid.com",
  }), null, "existing valid ss_ref is kept");
  assert.equal(referralCodeFromCookieHeader("not_ss_ref=mike4821; ss_ref_extra=zzzz"), null);
  assert.equal(referralCodeFromCookieHeader("ss_ref=NOPE; ss_ref=mike4821"), "mike4821");
  assert.equal(referralSetCookieHeader({
    ref: "mike4821",
    cookieHeader: "ss_ref=NOPE",
    host: "localhost",
  }), COOKIE, "an invalid cookie can be replaced");
  assert.equal(referralSetCookieHeader({
    cookieHeader: "ss_ref=mike4821",
    host: "drones.sleepysquid.com",
  }), null, "continuing without ?ref= does not clear the cookie");
});

test("signup and booking read the cookie, and a posted ref only when the cookie is absent", () => {
  const signup = {
    headers: { cookie: "ss_ref=mike4821" },
    body: { name: "Mike", email: "mike@example.com", password: "secret", ref: "othercode1" },
  };
  assert.equal(referralCodeFromRequest(signup), "mike4821");
  const bookingContinue = {
    headers: { cookie: "ss_ref=mike4821" },
    body: { service: "real-estate", email: "mike@example.com", name: "Mike" },
  };
  assert.equal(referralCodeFromRequest(bookingContinue), "mike4821");
  const posted = { headers: {}, body: { ref: "mike4821", email: "mike@example.com" }, query: {} };
  assert.equal(referralCodeFromRequest(posted), "mike4821");
  const queryOnly = { headers: {}, body: {}, query: { ref: "mike4821" } };
  assert.equal(referralCodeFromRequest(queryOnly), "mike4821");
  assert.equal(referralCodeFromRequest({ headers: {}, body: { ref: "NOPE" } }), null);
  assert.equal(preferencesWithReferral({ theme: "dark", referrerCode: "keepme01" }, "mike4821").referrerCode, "keepme01");
  assert.equal(preferencesWithReferral({ theme: "dark" }, "mike4821").referrerCode, "mike4821");
  assert.equal(preferencesWithReferral({ theme: "dark" }, "NOPE").referrerCode, undefined);
  assert.deepEqual(preferencesForClient({ theme: "dark", referrerCode: "mike4821" }), { theme: "dark" });
});

function referralStripe(seed = []) {
  const customers = new Map(seed.map((customer) => [customer.id, { metadata: {}, deleted: false, ...customer, metadata: { ...(customer.metadata || {}) } }]));
  const calls = [];
  let seq = seed.length;
  const fetchImpl = async (url, { method = "GET", headers, body } = {}) => {
    const u = new URL(url);
    if (u.host !== "api.stripe.com") throw new Error(`unexpected host ${u.host}`);
    const params = Object.fromEntries(new URLSearchParams(method === "GET" ? u.search : (body || "")));
    calls.push({ method, path: u.pathname, params, headers });
    const json = (payload, status = 200) => ({ ok: status < 400, status, json: async () => payload });
    if (/\/v1\/(products|prices|transfers)(\/|$)/.test(u.pathname)) {
      return json({ error: { type: "invalid_request_error" } }, 400);
    }
    if (u.pathname === "/v1/customers" && method === "GET") {
      const data = [...customers.values()].filter((customer) => !params.email || customer.email === params.email);
      return json({ data, has_more: false });
    }
    if (u.pathname === "/v1/customers" && method === "POST") {
      const id = `cus_${++seq}`;
      const metadata = {};
      for (const [key, value] of Object.entries(params)) {
        const match = key.match(/^metadata\[(.+)\]$/);
        if (match) metadata[match[1]] = value;
      }
      const customer = { id, email: params.email, name: params.name, metadata, deleted: false };
      customers.set(id, customer);
      return json(customer);
    }
    const one = u.pathname.match(/^\/v1\/customers\/([^/]+)$/);
    if (one && method === "GET") {
      const customer = customers.get(decodeURIComponent(one[1]));
      return customer ? json(customer) : json({ error: { code: "resource_missing" } }, 404);
    }
    if (one && method === "POST") {
      const customer = customers.get(decodeURIComponent(one[1]));
      if (!customer) return json({ error: { code: "resource_missing" } }, 404);
      for (const [key, value] of Object.entries(params)) {
        const match = key.match(/^metadata\[(.+)\]$/);
        if (match) customer.metadata[match[1]] = value;
      }
      return json(customer);
    }
    return json({ error: { type: "invalid_request_error" } }, 400);
  };
  return { fetchImpl, calls, customers };
}

async function withNoLiveFetch(run) {
  const original = globalThis.fetch;
  let live = 0;
  globalThis.fetch = async () => {
    live += 1;
    throw new Error("live stripe");
  };
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(live, 0, "no live Stripe call");
}

const testEnv = { STRIPE_INVOICING_SECRET_KEY: "sk_test_fake" };

test("signup and booking pass the code into customer create, and never call live Stripe", async () => {
  const signupFake = referralStripe();
  const signupReq = {
    headers: { cookie: "ss_ref=mike4821" },
    body: { name: "Mike", email: "mike@example.com", password: "secret" },
  };
  await withNoLiveFetch(async () => {
    const stamped = await stampReferralFromRequest(signupReq, {
      email: "mike@example.com",
      name: "Mike",
      env: testEnv,
      fetchImpl: signupFake.fetchImpl,
    });
    assert.equal(stamped.applied, true);
    assert.equal(stamped.referrerCode, "mike4821");
  });
  const created = signupFake.calls.find((call) => call.method === "POST" && call.path === "/v1/customers");
  assert.equal(created.params.email, "mike@example.com");
  assert.equal(created.params["metadata[referrer_code]"], "mike4821");
  assert.equal(created.params["metadata[source]"], "sleepysquid-hub");
  assert.equal(created.params["metadata[one_time]"], "1");
  assert.ok(!signupFake.calls.some((call) => /\/v1\/(products|prices|transfers)/.test(call.path)));

  const bookingFake = referralStripe();
  const bookingReq = {
    headers: { cookie: "ss_ref=mike4821" },
    body: { service: "real-estate", package: "listing-photos", email: "book@example.com", name: "Booker" },
  };
  await withNoLiveFetch(async () => {
    const stamped = await stampReferralFromRequest(bookingReq, {
      email: "book@example.com",
      name: "Booker",
      env: testEnv,
      fetchImpl: bookingFake.fetchImpl,
    });
    assert.equal(stamped.referrerCode, "mike4821");
  });
  assert.equal(bookingFake.calls.find((call) => call.method === "POST" && call.path === "/v1/customers").params["metadata[referrer_code]"], "mike4821");

  const postedFake = referralStripe();
  await withNoLiveFetch(async () => {
    const stamped = await stampReferralFromRequest(
      { headers: {}, body: { ref: "mike4821", email: "guest@example.com" } },
      { email: "guest@example.com", name: "Guest", env: testEnv, fetchImpl: postedFake.fetchImpl },
    );
    assert.equal(stamped.referrerCode, "mike4821");
  });
  assert.equal(postedFake.customers.get("cus_1").metadata.referrer_code, "mike4821");

  const kept = referralStripe();
  await withNoLiveFetch(async () => {
    const stamped = await stampReferralFromRequest(
      { headers: { cookie: "ss_ref=mike4821" }, body: { ref: "othercode1" } },
      { email: "mike@example.com", name: "Mike", env: testEnv, fetchImpl: kept.fetchImpl },
    );
    assert.equal(stamped.referrerCode, "mike4821");
  });

  const invalid = referralStripe();
  let invalidCalls = 0;
  await withNoLiveFetch(async () => {
    const stamped = await stampReferralFromRequest(
      { headers: { cookie: "ss_ref=NOPE" }, body: { ref: "no" } },
      { email: "mike@example.com", name: "Mike", env: testEnv, fetchImpl: invalid.fetchImpl },
    );
    assert.equal(stamped.applied, false);
    invalidCalls = invalid.calls.length;
  });
  assert.equal(invalidCalls, 0);

  const blocked = referralStripe();
  await withNoLiveFetch(async () => {
    const live = await stampReferralFromRequest(
      { headers: { cookie: "ss_ref=mike4821" } },
      { email: "mike@example.com", name: "Mike", env: { STRIPE_SECRET_KEY: "rk_live_fake" }, fetchImpl: blocked.fetchImpl },
    );
    assert.equal(live.applied, false);
    const missing = await stampReferralFromRequest(
      { headers: { cookie: "ss_ref=mike4821" } },
      { email: "mike@example.com", name: "Mike", env: {}, fetchImpl: blocked.fetchImpl },
    );
    assert.equal(missing.applied, false);
  });
  assert.equal(blocked.calls.length, 0);
});

test("reused customers gain referrer_code only when it is empty, and other metadata stays", async () => {
  const fake = referralStripe([
    { id: "cus_open", email: "open@example.com", metadata: { source: "sleepysquid-hub", plan: "gold" } },
    { id: "cus_kept", email: "kept@example.com", metadata: { source: "sleepysquid-hub", referrer_code: "keepme01", plan: "gold" } },
    { id: "cus_saved", email: "saved@example.com", metadata: { source: "sleepysquid-hub", note: "leave-me" } },
  ]);
  const client = createStripeClient({ env: testEnv, fetchImpl: fake.fetchImpl });
  await withNoLiveFetch(async () => {
    assert.equal(await ensureCustomerByEmail(client, { email: "Open@Example.com", name: "Open", referrerCode: "mike4821" }), "cus_open");
    assert.equal(await ensureCustomerByEmail(client, { email: "kept@example.com", name: "Kept", referrerCode: "mike4821" }), "cus_kept");
    assert.equal(await ensureCustomer(client, { id: "user-1", email: "saved@example.com", stripeCustomerId: "cus_saved", referrerCode: "mike4821" }), "cus_saved");
    const fresh = await ensureCustomer(client, { id: "user-2", email: "new@example.com", name: "New", referrerCode: "mike4821" });
    assert.equal(fresh, "cus_4");
  });

  assert.equal(fake.customers.get("cus_open").metadata.referrer_code, "mike4821");
  assert.equal(fake.customers.get("cus_open").metadata.source, "sleepysquid-hub");
  assert.equal(fake.customers.get("cus_open").metadata.plan, "gold");
  const openUpdate = fake.calls.find((call) => call.method === "POST" && call.path === "/v1/customers/cus_open");
  assert.equal(openUpdate.params["metadata[referrer_code]"], "mike4821");
  assert.equal(openUpdate.params["metadata[source]"], undefined);
  assert.equal(openUpdate.params["metadata[plan]"], undefined);

  assert.equal(fake.customers.get("cus_kept").metadata.referrer_code, "keepme01");
  assert.equal(fake.calls.some((call) => call.method === "POST" && call.path === "/v1/customers/cus_kept"), false);

  assert.equal(fake.customers.get("cus_saved").metadata.referrer_code, "mike4821");
  assert.equal(fake.customers.get("cus_saved").metadata.note, "leave-me");
  assert.equal(fake.customers.get("cus_saved").metadata.source, "sleepysquid-hub");

  const create = fake.calls.find((call) => call.method === "POST" && call.path === "/v1/customers");
  assert.equal(create.params["metadata[referrer_code]"], "mike4821");
  assert.equal(create.params["metadata[source]"], "sleepysquid-hub");
  assert.equal(create.params["metadata[hub_user_id]"], "user-2");
  assert.ok(!fake.calls.some((call) => /\/v1\/(products|prices|transfers)/.test(call.path)));
  assert.equal(metadataPatchForReferrer({ referrer_code: "keepme01", source: "sleepysquid-hub" }, "mike4821"), null);
  assert.deepEqual(metadataPatchForReferrer({ source: "sleepysquid-hub" }, "mike4821"), { referrer_code: "mike4821" });
});

test("checkout customer create and reuse set referrer_code without products, prices, or transfers", async () => {
  const created = [];
  const updates = [];
  const stripe = {
    customers: {
      create: async (params) => { created.push(params); return { id: "cus_new", metadata: params.metadata }; },
      retrieve: async (id) => ({ id, deleted: false, metadata: { source: "hub", plan: "gold", ...(id === "cus_kept" ? { referrer_code: "keepme01" } : {}) } }),
      update: async (id, params) => { updates.push({ id, params }); return { id }; },
    },
    products: { create: async () => { throw new Error("product"); } },
    prices: { create: async () => { throw new Error("price"); } },
    transfers: { create: async () => { throw new Error("transfer"); } },
  };
  const made = await applyReferralToCheckoutCustomer(stripe, { user: { email: "a@b.c", name: "A" }, referrerCode: "mike4821" });
  assert.equal(made.customerId, "cus_new");
  assert.equal(made.created, true);
  assert.deepEqual(created[0].metadata, { referrer_code: "mike4821" });
  assert.equal(created[0].email, "a@b.c");

  const reused = await applyReferralToCheckoutCustomer(stripe, { user: { customerId: "cus_open" }, referrerCode: "mike4821" });
  assert.equal(reused.customerId, "cus_open");
  assert.deepEqual(updates[0], { id: "cus_open", params: { metadata: { referrer_code: "mike4821" } } });

  const kept = await applyReferralToCheckoutCustomer(stripe, { user: { customerId: "cus_kept" }, referrerCode: "mike4821" });
  assert.equal(kept.customerId, "cus_kept");
  assert.equal(updates.length, 1);
  assert.equal(await applyReferralToCheckoutCustomer(stripe, { user: { email: "a@b.c" }, referrerCode: "NOPE" }), null);
});

test("landing, signup, and booking handlers are wired to the cookie and the customer stamp", () => {
  const middleware = read("middleware.js");
  assert.match(middleware, /referralSetCookieHeader/);
  assert.match(middleware, /withReferralCookie\(request, response\)/);
  const signup = read("pages/api/auth/signup.js");
  assert.match(signup, /referralCodeFromRequest\(req\)/);
  assert.match(signup, /stampReferralFromRequest\(req/);
  const booking = read("pages/api/bookings.js");
  assert.match(booking, /referralCodeFromRequest\(req\)/);
  assert.match(booking, /stampReferralCustomer\(/);
  const checkout = read("libs/stripe.js");
  assert.match(checkout, /applyReferralToCheckoutCustomer/);
  assert.match(read("pages/api/admin/invoicing/clients/[id]/invoices.js"), /referrerCode/);
});

test("referral context is request-local and ignores invalid codes", async () => {
  assert.equal(currentReferralCode(), null);
  await runWithReferralCode("mike4821", async () => {
    assert.equal(currentReferralCode(), "mike4821");
  });
  await runWithReferralCode("NOPE", async () => {
    assert.equal(currentReferralCode(), null);
  });
  assert.equal(currentReferralCode(), null);
});
