import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildCatalog, validateDraftInput, approvalSignature, signatureFromStripeInvoice, displayStatus,
  mirrorFromStripe, verifyStripeSignature, writesAllowed, keyMode, defaultDueDate, INVOICE_SOURCE,
} from "../../libs/invoicing/core.mjs";
import { createStripeClient, loadCatalog, ensureCustomer, createDraftInvoice, finalizeAndSend, voidOrDiscard, encodeForm, updateDraftInvoice, resendInvoice } from "../../libs/invoicing/stripeInvoices.mjs";

const NOW = new Date("2026-10-26T21:00:00Z");
const products = [
  { id: "prod_d", active: true, name: "Listing Photos", metadata: { service: "drones" } },
  { id: "prod_a", active: true, name: "AI Starter setup", metadata: { service: "ai" } },
  { id: "prod_w", active: true, name: "Website development", metadata: { service: "web" } },
  { id: "prod_x", active: true, name: "Dispatch Pro", metadata: { service: "dispatch" } },
  { id: "prod_x2", active: true, name: "Dispatch Solo", metadata: { service: "web" } },
  { id: "prod_bl", active: true, name: "Old tag only", metadata: { business_line: "drones" } },
  { id: "prod_y", active: true, name: "Some product", metadata: { service: "dispatch" } },
  { id: "prod_old", active: true, name: "Untagged", metadata: {} },
  { id: "prod_off", active: false, name: "Archived", metadata: { service: "drones" } },
];
const prices = [
  { id: "price_d", active: true, product: "prod_d", type: "one_time", unit_amount: 25000, currency: "usd" },
  { id: "price_a", active: true, product: "prod_a", type: "one_time", unit_amount: 50000, currency: "usd" },
  { id: "price_w", active: true, product: "prod_w", type: "one_time", unit_amount: 150000, currency: "usd" },
  { id: "price_wsub", active: true, product: "prod_w", type: "recurring", unit_amount: 9900, currency: "usd" },
  { id: "price_x", active: true, product: "prod_x", type: "one_time", unit_amount: 9900, currency: "usd" },
  { id: "price_old", active: true, product: "prod_old", type: "one_time", unit_amount: 100, currency: "usd" },
];

test("catalog keeps only service drones/ai/web (no Dispatch, business_line ignored), active, one-time prices", () => {
  const cat = buildCatalog(products, prices);
  assert.deepEqual(cat.map((p) => p.productId).sort(), ["prod_a", "prod_d", "prod_w"]);
  assert.deepEqual(cat.find((p) => p.productId === "prod_w").prices.map((p) => p.priceId), ["price_w"]);
  assert.ok(!JSON.stringify(cat).includes("Dispatch"));
});

test("draft validation: defaults, edited amounts, rejects foreign prices and past dates", () => {
  const cat = buildCatalog(products, prices);
  const ok = validateDraftInput({ lines: [{ priceId: "price_d" }, { priceId: "price_a", amountCents: 42000 }], memo: " thanks " }, cat, NOW);
  assert.ok(ok.ok);
  assert.equal(ok.value.totalCents, 67000);
  assert.equal(ok.value.dueDate, "2026-11-09");
  assert.equal(defaultDueDate(NOW), "2026-11-09");
  assert.equal(ok.value.memo, "thanks");
  assert.equal(ok.value.lines[1].listAmountCents, 50000);
  assert.ok(!validateDraftInput({ lines: [{ priceId: "price_x" }] }, cat, NOW).ok, "dispatch price rejected");
  assert.ok(!validateDraftInput({ lines: [{ priceId: "price_old" }] }, cat, NOW).ok, "untagged rejected");
  assert.ok(!validateDraftInput({ lines: [] }, cat, NOW).ok);
  assert.ok(!validateDraftInput({ lines: [{ priceId: "price_d", amountCents: 0 }] }, cat, NOW).ok);
  assert.ok(!validateDraftInput({ lines: [{ priceId: "price_d" }], dueDate: "2026-10-01" }, cat, NOW).ok);
});

test("approval signature matches Stripe invoice and changes when an amount changes", () => {
  const cat = buildCatalog(products, prices);
  const v = validateDraftInput({ lines: [{ priceId: "price_d", description: "Shoot" }] }, cat, NOW).value;
  const inv = { total: 25000, currency: "usd", due_date: v.dueTimestamp, lines: { data: [{ amount: 25000, description: "Shoot" }] } };
  assert.equal(signatureFromStripeInvoice(inv), approvalSignature(v));
  inv.lines.data[0].amount = 26000; inv.total = 26000;
  assert.notEqual(signatureFromStripeInvoice(inv), approvalSignature(v));
});

test("status mapping: overdue derived from due date; mirror ignores non-hub invoices", () => {
  assert.equal(displayStatus({ status: "open", due_date: "2026-10-01T00:00:00Z" }, NOW), "overdue");
  assert.equal(displayStatus({ status: "open", due_date: "2026-12-01T00:00:00Z" }, NOW), "open");
  assert.equal(displayStatus({ status: "paid", due_date: "2026-10-01T00:00:00Z" }, NOW), "paid");
  assert.equal(mirrorFromStripe({ object: "invoice", id: "in_1", metadata: { service: "dispatch" } }, NOW), null);
  const m = mirrorFromStripe({ object: "invoice", id: "in_2", customer: "cus_1", status: "open", due_date: 1, total: 5, metadata: { source: INVOICE_SOURCE, business_lines: "drones,ai,web,dispatch" } }, NOW);
  assert.equal(m.overdue, true);
  assert.deepEqual(m.business_lines, ["drones", "ai", "web"]);
});

test("webhook signature verification", () => {
  const secret = "whsec_test"; const body = '{"id":"evt_1"}'; const t = 1_800_000_000;
  const sig = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.ok(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, 300, t + 10));
  assert.ok(!verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, 300, t + 10));
  assert.ok(!verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, 300, t + 1000), "too old");
  assert.ok(!verifyStripeSignature(body, `t=${t},v1=${sig}`, "", 300, t));
});

test("key mode and live write gate", () => {
  assert.equal(keyMode("sk_test_x"), "test");
  assert.equal(keyMode("rk_live_x"), "live");
  assert.equal(writesAllowed("sk_test_x", {}), true);
  assert.equal(writesAllowed("sk_live_x", {}), false);
  assert.equal(writesAllowed("sk_live_x", { INVOICING_LIVE_ENABLED: "true" }), true);
  assert.equal(writesAllowed("", { INVOICING_LIVE_ENABLED: "true" }), false);
  assert.equal(encodeForm({ a: { b: 1 }, c: [1, 2] }).join("&"), "a%5Bb%5D=1&c%5B%5D=1&c%5B%5D=2");
});

/** In-memory fake Stripe API that records every request. */
function fakeStripe() {
  const calls = []; const invoices = {}; const items = [];
  let n = 0;
  const fetchImpl = async (url, { method, headers, body }) => {
    const u = new URL(url); const p = Object.fromEntries(new URLSearchParams(body || u.search));
    calls.push({ method, path: u.pathname, params: p, headers });
    const json = (o, s = 200) => ({ ok: s < 400, status: s, json: async () => o });
    const path = u.pathname.replace("/v1", "");
    let m0;
    if (path === "/products") return json({ data: products, has_more: false });
    if (path === "/prices") return json({ data: prices, has_more: false });
    if (path === "/customers" && method === "POST") return json({ id: "cus_new" });
    if (path === "/invoices" && method === "POST") {
      const id = `in_${++n}`;
      invoices[id] = { object: "invoice", id, customer: p.customer, status: "draft", currency: p.currency, due_date: Number(p.due_date), description: p.description, livemode: false, total: 0, metadata: { source: p["metadata[source]"], business_lines: p["metadata[business_lines]"] }, lines: { data: [] } };
      return json(invoices[id]);
    }
    if (path === "/invoiceitems") {
      const inv = invoices[p.invoice];
      const amount = p.price ? prices.find((x) => x.id === p.price).unit_amount : Number(p["price_data[unit_amount]"] ?? p.unit_amount);
      const qty = Number(p.quantity || 1);
      items.push(p); inv.lines.data.push({ amount: amount * qty, quantity: qty, description: p.description, invoice_item: `ii_${items.length}` }); inv.total += amount * qty;
      return json({ id: `ii_${items.length}` });
    }
    if ((m0 = path.match(/^\/invoiceitems\/(ii_\d+)$/)) && method === "DELETE") {
      for (const inv of Object.values(invoices)) {
        const hit = inv.lines.data.find((l) => l.invoice_item === m0[1]);
        if (hit) { inv.total -= hit.amount; inv.lines.data = inv.lines.data.filter((l) => l !== hit); }
      }
      return json({ deleted: true });
    }
    if ((m0 = path.match(/^\/invoices\/(in_\d+)\/lines$/))) return json({ data: invoices[m0[1]].lines.data, has_more: false });
    if ((m0 = path.match(/^\/invoices\/(in_\d+)$/)) && method === "POST") {
      const inv = invoices[m0[1]]; inv.due_date = Number(p.due_date); inv.description = p.description;
      return json(inv);
    }
    let m;
    if ((m = path.match(/^\/invoices\/(in_\d+)$/))) {
      if (method === "DELETE") { delete invoices[m[1]]; return json({ deleted: true }); }
      return invoices[m[1]] ? json(invoices[m[1]]) : json({ error: { code: "resource_missing" } }, 404);
    }
    if ((m = path.match(/^\/invoices\/(in_\d+)\/(finalize|send|void)$/))) {
      const inv = invoices[m[1]];
      if (m[2] === "finalize") Object.assign(inv, { status: "open", number: "SQ-0001", hosted_invoice_url: "https://invoice.stripe.com/i/x", invoice_pdf: "https://pay.stripe.com/invoice/x/pdf" });
      if (m[2] === "void") inv.status = "void";
      return json(inv);
    }
    return json({ error: { type: "invalid_request_error" } }, 400);
  };
  return { fetchImpl, calls, invoices };
}

test("end-to-end against a fake Stripe: draft -> send -> webhook mirror -> void", async () => {
  const fake = fakeStripe();
  const client = createStripeClient({ env: { STRIPE_INVOICING_SECRET_KEY: "sk_test_fake" }, fetchImpl: fake.fetchImpl });
  const catalog = await loadCatalog(client);
  const draft = validateDraftInput({ lines: [{ priceId: "price_d" }, { priceId: "price_w", amountCents: 120000, description: "Site build (discounted)" }], memo: "Thanks!" }, catalog, NOW).value;
  const user = { id: "u1", email: "client@example.com", name: "Client" };
  const customerId = await ensureCustomer(client, user);
  assert.equal(customerId, "cus_new");
  const inv = await createDraftInvoice(client, { customerId, user, draft, requestId: "req-1234567890abcdef" });
  assert.equal(inv.status, "draft");
  assert.equal(inv.total, 145000);
  assert.equal(signatureFromStripeInvoice(inv), approvalSignature(draft));
  const invCreate = fake.calls.find((c) => c.path === "/v1/invoices" && c.method === "POST");
  assert.equal(invCreate.params.auto_advance, "false");
  assert.equal(invCreate.params.collection_method, "send_invoice");
  const itemCalls = fake.calls.filter((c) => c.path === "/v1/invoiceitems");
  assert.equal(itemCalls[0].params.price, "price_d", "unchanged amount uses the existing Price");
  assert.equal(itemCalls[1].params["price_data[product]"], "prod_w", "edited amount keeps the product link");
  for (const c of fake.calls.filter((c) => c.method !== "GET")) assert.ok(c.headers["Idempotency-Key"], `${c.path} has idempotency key`);
  assert.ok(!fake.calls.some((c) => /finalize|send/.test(c.path)), "nothing sent at draft time");

  const sent = await finalizeAndSend(client, inv.id);
  assert.equal(sent.status, "open");
  const mirror = mirrorFromStripe(sent, NOW);
  assert.equal(mirror.hosted_invoice_url, "https://invoice.stripe.com/i/x");
  assert.equal(displayStatus(mirror, NOW), "open");
  const paidEvent = { ...sent, status: "paid", status_transitions: { paid_at: 1_800_000_000 } };
  assert.equal(mirrorFromStripe(paidEvent, NOW).status, "paid");

  const voided = await voidOrDiscard(client, inv.id);
  assert.equal(voided.status, "void");
  await assert.rejects(() => voidOrDiscard(client, inv.id), /Cannot void/);
});

test("draft discard deletes; live key without flag cannot write", async () => {
  const fake = fakeStripe();
  const client = createStripeClient({ env: { STRIPE_SECRET_KEY: "sk_test_fake" }, fetchImpl: fake.fetchImpl });
  const cat = await loadCatalog(client);
  const draft = validateDraftInput({ lines: [{ priceId: "price_a" }] }, cat, NOW).value;
  const inv = await createDraftInvoice(client, { customerId: "cus_1", user: { id: "u" }, draft, requestId: "req-abcdefabcdef1234" });
  assert.equal((await voidOrDiscard(client, inv.id)).status, "deleted");

  const live = createStripeClient({ env: { STRIPE_SECRET_KEY: "rk_live_fake" }, fetchImpl: fake.fetchImpl });
  const before = fake.calls.length;
  await assert.rejects(() => ensureCustomer(live, { id: "u2", email: "a@b.c" }), /disabled/);
  assert.equal(fake.calls.length, before, "no request reached Stripe");
  await loadCatalog(live); // reads are fine
});

import { isMissingSchemaError, loadClientInvoices, invoicingSchemaReady, NOT_MIGRATED_MESSAGE } from "../../libs/invoicing/core.mjs";

test("missing-schema detection covers Postgres and PostgREST codes, not other errors", () => {
  assert.ok(isMissingSchemaError({ code: "42703", message: "column users.stripe_customer_id does not exist" }));
  assert.ok(isMissingSchemaError({ code: "42P01" }));
  assert.ok(isMissingSchemaError({ code: "PGRST205", message: "Could not find the table 'public.invoices' in the schema cache" }));
  assert.ok(isMissingSchemaError({ message: "Could not find the 'stripe_customer_id' column of 'users' in the schema cache" }));
  assert.ok(!isMissingSchemaError({ code: "23505", message: "duplicate key" }));
  assert.ok(!isMissingSchemaError(new Error("connection refused")));
  assert.match(NOT_MIGRATED_MESSAGE, /20261026210000_invoicing\.sql/);
});

test("invoice list returns empty + migrated:false instead of failing when not migrated", async () => {
  const client = { id: "u1", name: "Ana", email: "ana@example.com" };
  const missingCol = Object.assign(new Error("column users.stripe_customer_id does not exist"), { code: "42703" });
  const missingTable = Object.assign(new Error("relation \"invoices\" does not exist"), { code: "42P01" });
  let listed = false;
  const a = await loadClientInvoices("u1", { getClient: async () => { throw missingCol; }, getClientBasic: async () => client, listInvoices: async () => { listed = true; return []; } });
  assert.deepEqual(a, { client, invoices: [], migrated: false });
  assert.equal(listed, false);
  const b = await loadClientInvoices("u1", { getClient: async () => client, getClientBasic: async () => client, listInvoices: async () => { throw missingTable; } });
  assert.deepEqual(b, { client, invoices: [], migrated: false });
  const c = await loadClientInvoices("u1", { getClient: async () => client, getClientBasic: async () => client, listInvoices: async () => [{ id: "r1" }] });
  assert.deepEqual(c, { client, invoices: [{ id: "r1" }], migrated: true });
  const d = await loadClientInvoices("nope", { getClient: async () => null, getClientBasic: async () => null, listInvoices: async () => [] });
  assert.equal(d.client, null);
  await assert.rejects(loadClientInvoices("u1", { getClient: async () => { throw new Error("db down"); }, getClientBasic: async () => client, listInvoices: async () => [] }), /db down/);
});

test("draft creation is blocked until every schema probe passes", async () => {
  const missing = Object.assign(new Error("x"), { code: "PGRST205" });
  assert.equal(await invoicingSchemaReady([async () => {}, async () => { throw missing; }]), false);
  assert.equal(await invoicingSchemaReady([async () => {}, async () => {}]), true);
  await assert.rejects(invoicingSchemaReady([async () => { throw new Error("timeout"); }]), /timeout/);
});

import { filterInvoices, STATUS_FILTERS } from "../../libs/invoicing/core.mjs";
import fs from "node:fs";

test("invoice list filters by display status and service line", () => {
  const list = [
    { id: 1, status: "draft", businessLines: ["drones"] },
    { id: 2, status: "open", businessLines: ["ai"] },
    { id: 3, status: "overdue", businessLines: ["web", "ai"] },
    { id: 4, status: "paid", businessLines: ["web"] },
    { id: 5, status: "void", businessLines: [] },
    { id: 6, status: "deleted", businessLines: ["drones"] },
  ];
  assert.deepEqual(filterInvoices(list).map((i) => i.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(filterInvoices(list, { status: "overdue" }).map((i) => i.id), [3]);
  assert.deepEqual(filterInvoices(list, { line: "ai" }).map((i) => i.id), [2, 3]);
  assert.deepEqual(filterInvoices(list, { status: "paid", line: "web" }).map((i) => i.id), [4]);
  assert.deepEqual(filterInvoices(list, { status: "open", line: "web" }), []);
  for (const s of ["draft", "open", "paid", "overdue", "void"]) assert.ok(STATUS_FILTERS.includes(s));
});

test("Invoices section is wired for SleepySquid admins only and the modal panel is gone", () => {
  const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const roles = read("libs/userRoles.js");
  const block = roles.slice(roles.indexOf("if (isSleepySquidAdmin) {"), roles.indexOf("return adminNav;"));
  assert.match(block, /name: 'Invoices', href: '\/dashboard\?section=invoices'/);
  assert.match(read("pages/dashboard.js"), /'invoices'\]/);
  const admin = read("components/dashboard/AdminContent.jsx");
  assert.match(admin, /case 'invoices':\s*\n\s*if \(!isSleepySquidAdmin\)/);
  assert.doesNotMatch(read("components/admin/UserModal.jsx"), /ClientInvoices/);
  assert.match(read("components/admin/UsersList.jsx"), /section=invoices&client=/);
  const api = read("pages/api/admin/invoicing/invoices/index.js");
  assert.match(api, /requireAdmin\(req, res, \["GET"\]\)/);
});

test("quantity: validated, multiplies line totals, sent to Stripe, signature matches Stripe", async () => {
  const fake = fakeStripe();
  const client = createStripeClient({ env: { STRIPE_INVOICING_SECRET_KEY: "sk_test_fake" }, fetchImpl: fake.fetchImpl });
  const cat = await loadCatalog(client);
  assert.equal(validateDraftInput({ lines: [{ priceId: "price_d", quantity: 0 }] }, cat, NOW).ok, false);
  assert.equal(validateDraftInput({ lines: [{ priceId: "price_d", quantity: 1.5 }] }, cat, NOW).ok, false);
  const v = validateDraftInput({ lines: [{ priceId: "price_d", quantity: 3 }, { priceId: "price_a", amountCents: 1000, quantity: 2 }] }, cat, NOW).value;
  assert.equal(v.totalCents, 25000 * 3 + 2000);
  const inv = await createDraftInvoice(client, { customerId: "cus_1", user: { id: "u" }, draft: v, requestId: "req-qty-0000000000001" });
  assert.equal(inv.total, v.totalCents);
  assert.equal(fake.calls.filter((c) => c.path === "/v1/invoiceitems").map((c) => c.params.quantity).join(","), "3,2");
  assert.equal(signatureFromStripeInvoice(inv), approvalSignature(v));
});

test("updateDraftInvoice replaces lines/due/memo; refuses non-drafts; resend only for open", async () => {
  const fake = fakeStripe();
  const client = createStripeClient({ env: { STRIPE_INVOICING_SECRET_KEY: "sk_test_fake" }, fetchImpl: fake.fetchImpl });
  const cat = await loadCatalog(client);
  const v1 = validateDraftInput({ lines: [{ priceId: "price_d" }, { priceId: "price_a" }] }, cat, NOW).value;
  const inv = await createDraftInvoice(client, { customerId: "cus_1", user: { id: "u" }, draft: v1, requestId: "req-edit-000000000001" });
  const v2 = validateDraftInput({ lines: [{ priceId: "price_w", quantity: 2 }], memo: "new memo", dueDate: "2026-11-30" }, cat, NOW).value;
  const edited = await updateDraftInvoice(client, inv.id, { draft: v2, requestId: "req-edit-000000000002" });
  assert.equal(edited.total, 300000);
  assert.equal(edited.lines.data.length, 1);
  assert.equal(edited.description, "new memo");
  assert.equal(signatureFromStripeInvoice(edited), approvalSignature(v2));
  await assert.rejects(() => resendInvoice(client, inv.id, 1), /Only unpaid/);
  await finalizeAndSend(client, inv.id);
  await assert.rejects(() => updateDraftInvoice(client, inv.id, { draft: v2, requestId: "req-edit-000000000003" }), /Only drafts/);
  const before = fake.calls.filter((c) => c.path.endsWith("/send")).length;
  await resendInvoice(client, inv.id, 7);
  assert.equal(fake.calls.filter((c) => c.path.endsWith("/send")).length, before + 1);
  const sendCall = fake.calls.filter((c) => c.path.endsWith("/send")).pop();
  assert.ok(sendCall.headers["Idempotency-Key"], "resend is idempotent per minute");
});

test("custom line items: validated like other lines, never create Products/Prices, persist through draft edits", async () => {
  const fake = fakeStripe();
  const client = createStripeClient({ env: { STRIPE_INVOICING_SECRET_KEY: "sk_test_fake" }, fetchImpl: fake.fetchImpl });
  const cat = await loadCatalog(client);
  // validation
  assert.equal(validateDraftInput({ lines: [{ custom: true, description: "Web dev", amountCents: 0 }] }, cat, NOW).ok, false);
  assert.equal(validateDraftInput({ lines: [{ custom: true, description: "Web dev", amountCents: -500 }] }, cat, NOW).ok, false);
  assert.equal(validateDraftInput({ lines: [{ custom: true, description: "  ", amountCents: 500 }] }, cat, NOW).ok, false);
  assert.equal(validateDraftInput({ lines: [{ custom: true, description: "Web dev", amountCents: 500, quantity: 0 }] }, cat, NOW).ok, false);
  const v = validateDraftInput({ lines: [{ custom: true, description: "Web dev", amountCents: 12500, quantity: 4 }, { priceId: "price_d" }] }, cat, NOW).value;
  assert.equal(v.totalCents, 50000 + 25000);
  assert.equal(v.lines[0].custom, true);
  assert.equal(v.currency, "usd");
  // create: custom item uses unit_amount + currency + description, no price/price_data
  const inv = await createDraftInvoice(client, { customerId: "cus_1", user: { id: "u" }, draft: v, requestId: "req-custom-00000000001" });
  const item = fake.calls.find((c) => c.path === "/v1/invoiceitems" && c.params.description === "Web dev").params;
  assert.equal(item.unit_amount, "12500"); assert.equal(item.currency, "usd"); assert.equal(item.quantity, "4");
  assert.equal(item.price, undefined); assert.equal(item["price_data[product]"], undefined); assert.equal(item["price_data[unit_amount]"], undefined);
  assert.equal(item["metadata[custom]"], "1");
  assert.equal(inv.total, v.totalCents);
  assert.equal(signatureFromStripeInvoice(inv), approvalSignature(v));
  assert.ok(!fake.calls.some((c) => c.method === "POST" && /^\/v1\/(products|prices)/.test(c.path)), "never creates Products or Prices");
  // edit draft keeps custom lines
  const v2 = validateDraftInput({ lines: [{ custom: true, description: "Web dev (revised)", amountCents: 20000 }] }, cat, NOW).value;
  const edited = await updateDraftInvoice(client, inv.id, { draft: v2, requestId: "req-custom-00000000002" });
  assert.equal(edited.total, 20000);
  assert.deepEqual(edited.lines.data.map((l) => l.description), ["Web dev (revised)"]);
  assert.ok(!fake.calls.some((c) => c.method === "POST" && /^\/v1\/(products|prices)/.test(c.path)));
});
