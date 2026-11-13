// Referral rows in the portal schema. Callers pass the PostgREST `db` helper.
import crypto from "crypto";

export const FEE_CENTS = 20000;
const CODE = /^[a-z0-9][a-z0-9-]{3,31}$/;
const enc = (value) => encodeURIComponent(value);

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalizeCode(value) {
  const code = String(value || "").trim().toLowerCase();
  return CODE.test(code) ? code : "";
}

export function codeBase(name) {
  const word = String(name || "").trim().split(/[\s-]+/)[0] || "";
  const letters = word.toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
  return letters || "friend";
}

export function cleanPhone(value) {
  const phone = String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 40);
  if (!phone) return null;
  if (!/^[0-9+().\-\s]{7,40}$/.test(phone)) {
    const err = new Error("Enter a phone number or leave it blank");
    err.status = 400;
    throw err;
  }
  return phone;
}

function cleanNote(value) {
  const text = String(value || "").trim().slice(0, 500);
  return text || null;
}

export function lineIsReferralEligible(metadata) {
  const service = String(metadata?.service || "").toLowerCase();
  if (service === "web") return String(metadata?.referral_eligible || "").toLowerCase() === "true";
  return true;
}

export function productIdFromLine(line) {
  const embedded = line?.price?.product;
  if (embedded && typeof embedded === "object" && embedded.id) return embedded.id;
  if (typeof embedded === "string") return embedded;
  const priced = line?.pricing?.price_details?.product;
  return typeof priced === "string" ? priced : priced?.id || "";
}

export async function invoiceQualifies(invoice, retrieveProduct) {
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  if (!lines.length) return true;
  let eligible = false;
  for (const line of lines) {
    const embedded = line?.price?.product;
    let metadata = embedded && typeof embedded === "object" ? embedded.metadata : null;
    const productId = productIdFromLine(line);
    if (!metadata) {
      if (!productId) { eligible = true; continue; }
      if (!retrieveProduct) {
        const err = new Error("Product metadata is not available");
        err.status = 503;
        throw err;
      }
      const product = await retrieveProduct(productId);
      metadata = product?.metadata || {};
    }
    if (lineIsReferralEligible(metadata)) eligible = true;
  }
  return eligible;
}

export function signReferrerToken(referrerId, secret, now = Date.now()) {
  if (!secret || !referrerId) return "";
  const payload = Buffer.from(JSON.stringify({ rid: referrerId, exp: now + 14 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyReferrerToken(token, secret, now = Date.now()) {
  if (!secret) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  let body;
  try { body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return null; }
  if (!body?.rid || typeof body.exp !== "number" || body.exp <= now) return null;
  return body.rid;
}

export function shareLinks(code, origin) {
  const base = `${String(origin || "https://sleepysquid.com").replace(/\/$/, "")}/r/${code}`;
  return { hub: base, web: `${base}?to=web`, drones: `${base}?to=drones`, ai: `${base}?to=ai` };
}

async function getReferrerByCode(db, code) {
  const clean = normalizeCode(code);
  if (!clean) return null;
  const rows = await db(`portal_referrers?code=eq.${enc(clean)}&active=eq.true&archived_at=is.null&select=*`);
  return rows?.[0] || null;
}

export async function createReferrer(db, input) {
  const name = String(input.name || "").trim().slice(0, 120);
  const email = normalizeEmail(input.email);
  if (!name || !email) {
    const err = new Error("Name and a valid email are required");
    err.status = 400;
    throw err;
  }
  const taken = await db(`portal_referrers?email=eq.${enc(email)}&select=id`);
  if (taken?.length) {
    const err = new Error("A referrer with that email already exists");
    err.status = 409;
    throw err;
  }
  let code = normalizeCode(input.code);
  if (input.code && !code) {
    const err = new Error("Code must be 4 to 32 lowercase letters, numbers, or hyphens");
    err.status = 400;
    throw err;
  }
  const phone = cleanPhone(input.phone);
  const notes = cleanNote(input.notes);
  const base = codeBase(name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const next = code || `${base}${String(crypto.randomInt(0, 10000)).padStart(4, "0")}`;
    const rows = await db("portal_referrers?on_conflict=code", {
      method: "POST",
      body: { id: crypto.randomUUID(), name, email, phone, notes, code: next, active: true, payouts_enabled: false, created_at: new Date().toISOString() },
      prefer: "resolution=ignore-duplicates,return=representation",
    });
    if (rows?.length) return rows[0];
    if (code) {
      const err = new Error("That code is already in use");
      err.status = 409;
      throw err;
    }
  }
  const err = new Error("Could not create a code");
  err.status = 500;
  throw err;
}

export async function submitRequest(db, input) {
  const name = String(input.name || "").trim().slice(0, 120);
  const email = normalizeEmail(input.email);
  if (!name || !email) {
    const err = new Error("Name and a valid email are required");
    err.status = 400;
    throw err;
  }
  const phone = cleanPhone(input.phone);
  const note = cleanNote(input.note);
  const pending = await db(`portal_referral_requests?email=eq.${enc(email)}&status=eq.pending&archived_at=is.null&select=id`);
  if (pending?.length) return { duplicate: true, request: pending[0] };
  const rows = await db("portal_referral_requests", {
    method: "POST",
    body: { id: crypto.randomUUID(), name, email, phone, note, status: "pending", created_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  return { duplicate: false, request: rows[0] };
}

export async function approveRequest(db, id) {
  const rows = await db(`portal_referral_requests?id=eq.${enc(id)}&select=*`);
  const request = rows?.[0];
  if (!request || request.archived_at) {
    const err = new Error("Request not found");
    err.status = 404;
    throw err;
  }
  if (request.status !== "pending") {
    const err = new Error("That request is already decided");
    err.status = 409;
    throw err;
  }
  let referrer;
  try {
    referrer = await createReferrer(db, { name: request.name, email: request.email, phone: request.phone, notes: request.note });
  } catch (err) {
    if (err.status !== 409) throw err;
    const existing = await db(`portal_referrers?email=eq.${enc(request.email)}&select=*`);
    referrer = existing?.[0];
    if (!referrer) throw err;
  }
  const now = new Date().toISOString();
  await db(`portal_referral_requests?id=eq.${enc(id)}`, {
    method: "PATCH",
    body: { status: "approved", referrer_id: referrer.id, decided_at: now },
    prefer: "return=minimal",
  });
  return { referrer, request: { ...request, status: "approved", referrer_id: referrer.id } };
}

export async function declineRequest(db, id) {
  const now = new Date().toISOString();
  const rows = await db(`portal_referral_requests?id=eq.${enc(id)}&status=eq.pending&archived_at=is.null`, {
    method: "PATCH",
    body: { status: "declined", decided_at: now },
    prefer: "return=representation",
  });
  if (!rows?.length) {
    const err = new Error("Request not found");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function archiveRequest(db, id) {
  const rows = await db(`portal_referral_requests?id=eq.${enc(id)}&archived_at=is.null`, {
    method: "PATCH",
    body: { archived_at: new Date().toISOString() },
    prefer: "return=representation",
  });
  if (!rows?.length) {
    const err = new Error("Request not found");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

export async function setReferrerActive(db, id, active) {
  const rows = await db(`portal_referrers?id=eq.${enc(id)}`, {
    method: "PATCH",
    body: { active: !!active },
    prefer: "return=representation",
  });
  if (!rows?.length) {
    const err = new Error("Referrer not found");
    err.status = 404;
    throw err;
  }
  return rows[0];
}

async function ensureReferral(db, { referrer, customerId, email, name, businessLine }) {
  if (customerId) {
    const existing = await db(`portal_referrals?stripe_customer_id=eq.${enc(customerId)}&select=*`);
    if (existing?.length) return { referral: existing[0], created: false };
  }
  if (email) {
    const byEmail = await db(`portal_referrals?customer_email=eq.${enc(email)}&select=*`);
    if (byEmail?.length) return { referral: byEmail[0], created: false };
  }
  const rows = await db("portal_referrals", {
    method: "POST",
    body: {
      id: crypto.randomUUID(),
      referrer_id: referrer.id,
      stripe_customer_id: customerId || null,
      customer_email: email || `stripe-${customerId}@example.test`,
      customer_name: name || null,
      business_line: businessLine || "webdev",
      payment_status: "signed_up",
      signed_up_at: new Date().toISOString(),
    },
    prefer: "return=representation",
  });
  return { referral: rows[0], created: true };
}

export async function attributeCode(db, { code, customerId, email, name, businessLine }) {
  const referrer = await getReferrerByCode(db, code);
  if (!referrer) return { attributed: false };
  if (email && email === referrer.email) return { attributed: false, self: true };
  const result = await ensureReferral(db, { referrer, customerId, email: normalizeEmail(email), name, businessLine });
  return { attributed: true, ...result, code: referrer.code };
}

async function findReferral(db, { customerId, email }) {
  if (customerId) {
    const rows = await db(`portal_referrals?stripe_customer_id=eq.${enc(customerId)}&select=*`);
    if (rows?.[0]) return rows[0];
  }
  const clean = normalizeEmail(email);
  if (clean) {
    const rows = await db(`portal_referrals?customer_email=eq.${enc(clean)}&select=*`);
    if (rows?.[0]) return rows[0];
  }
  return null;
}

export async function recordEligiblePayment(db, { customerId, email, invoiceId, invoice, retrieveProduct, businessLine }) {
  const referral = await findReferral(db, { customerId, email });
  if (!referral || referral.payment_status === "void") return { created: false };
  if (referral.payment_status !== "signed_up") return { created: false };
  const payouts = await db(`portal_referral_payouts?referral_id=eq.${enc(referral.id)}&select=id`);
  if (payouts?.length) return { created: false };
  if (invoice && !(await invoiceQualifies(invoice, retrieveProduct))) return { created: false, ineligible: true };
  const now = new Date().toISOString();
  const rows = await db("portal_referral_payouts?on_conflict=referral_id", {
    method: "POST",
    body: { id: crypto.randomUUID(), referral_id: referral.id, amount_cents: FEE_CENTS, status: "pending", created_at: now },
    prefer: "resolution=ignore-duplicates,return=representation",
  });
  if (!rows?.length) return { created: false };
  await db(`portal_referrals?id=eq.${enc(referral.id)}&payment_status=eq.signed_up`, {
    method: "PATCH",
    body: { payment_status: "first_invoice_paid", first_paid_at: now, stripe_invoice_id: invoiceId || null, business_line: businessLine || referral.business_line },
    prefer: "return=minimal",
  });
  return { created: true, payout: rows[0] };
}

export async function claimEvent(db, id, eventType) {
  const rows = await db("portal_referral_events?on_conflict=id", {
    method: "POST",
    body: { id, event_type: eventType, created_at: new Date().toISOString() },
    prefer: "resolution=ignore-duplicates,return=representation",
  });
  return !!rows?.length;
}

export async function listAdmin(db) {
  const referrers = (await db("portal_referrers?select=*")) || [];
  const requests = (await db("portal_referral_requests?select=*")) || [];
  const referrals = (await db("portal_referrals?select=*")) || [];
  const payouts = (await db("portal_referral_payouts?select=*")) || [];
  return { referrers, requests, referrals, payouts };
}

export async function approvePayout(db, { payoutId, stripeTransfer, connectConfigured }) {
  const rows = await db(`portal_referral_payouts?id=eq.${enc(payoutId)}&select=*`);
  const payout = rows?.[0];
  if (!payout || payout.status === "void") {
    const err = new Error("Payout cannot be approved");
    err.status = 409;
    throw err;
  }
  if (payout.stripe_transfer_id) return { transferred: false, status: "paid", transferId: payout.stripe_transfer_id, already: true };
  if (payout.status === "paid") {
    const err = new Error("Payout cannot be approved");
    err.status = 409;
    throw err;
  }
  const referrals = await db(`portal_referrals?id=eq.${enc(payout.referral_id)}&select=*`);
  const referral = referrals?.[0];
  const referrers = referral ? await db(`portal_referrers?id=eq.${enc(referral.referrer_id)}&select=*`) : [];
  const referrer = referrers?.[0];
  const now = new Date().toISOString();
  const ready = !!connectConfigured && referrer?.stripe_account_id && referrer.payouts_enabled;
  if (!ready) {
    await db(`portal_referral_payouts?id=eq.${enc(payoutId)}`, {
      method: "PATCH",
      body: { status: "approved_awaiting_onboarding", approved_at: now, note: null },
      prefer: "return=minimal",
    });
    return { transferred: false, status: "approved_awaiting_onboarding", manual: true };
  }
  const amount = Number(payout.amount_cents) || FEE_CENTS;
  let transfer;
  try {
    transfer = await stripeTransfer({
      amount,
      currency: "usd",
      destination: referrer.stripe_account_id,
      metadata: { referral_id: referral.id, payout_id: payout.id },
    }, `referral_${referral.id}`);
  } catch {
    const err = new Error("Could not send the payout");
    err.status = 502;
    throw err;
  }
  await db(`portal_referral_payouts?id=eq.${enc(payoutId)}`, {
    method: "PATCH",
    body: { status: "paid", stripe_transfer_id: transfer.id, approved_at: payout.approved_at || now, paid_at: now, note: null },
    prefer: "return=minimal",
  });
  return { transferred: true, status: "paid", transferId: transfer.id, amount, paidAt: now };
}
