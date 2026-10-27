import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chipCounts, composerProblems, daysOverdue, dueDateForChip, filterInvoices, LIST_CHIPS, matchesClientSearch, rowActions, STATUS_CHIP_LABEL } from "../../libs/invoicing/core.mjs";

const NOW = new Date("2026-10-26T21:00:00Z");
const inv = (status, extra = {}) => ({ id: status, status, client: { name: "Ann Lee", email: "ann@x.com" }, ...extra });
const rows = [inv("draft"), inv("open"), inv("overdue", { dueDate: "2026-10-20T23:59:59Z" }), inv("paid"), inv("void"), { ...inv("open"), id: "o2", client: { name: "Bob", email: "bob@y.com" } }];
const read = (f) => fs.readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("chips: All/Unpaid/Overdue/Paid/Drafts with counts; Unpaid = open + overdue", () => {
  assert.deepEqual(LIST_CHIPS, ["all", "unpaid", "overdue", "paid", "draft"]);
  assert.deepEqual(chipCounts(rows), { all: 6, unpaid: 3, overdue: 1, paid: 1, draft: 1 });
  assert.deepEqual(chipCounts(rows, "bob"), { all: 1, unpaid: 1, overdue: 0, paid: 0, draft: 0 });
  assert.equal(filterInvoices(rows, { status: "unpaid" }).length, 3);
});

test("status chip labels and days overdue", () => {
  assert.equal(STATUS_CHIP_LABEL.open, "Unpaid");
  assert.equal(STATUS_CHIP_LABEL.overdue, "Overdue");
  assert.equal(daysOverdue(rows[2], NOW), 5);
  assert.equal(daysOverdue(rows[1], NOW), 0);
});

test("client search matches name, email, company, number", () => {
  assert.ok(matchesClientSearch(rows[0], "ANN"));
  assert.ok(matchesClientSearch({ ...rows[0], number: "SQ-0042" }, "0042"));
  assert.ok(!matchesClientSearch(rows[0], "zzz"));
});

test("row actions per status", () => {
  assert.deepEqual(rowActions({ status: "draft" }), ["edit", "send", "delete"]);
  assert.deepEqual(rowActions({ status: "open" }), ["copyLink", "resend", "void"]);
  assert.deepEqual(rowActions({ status: "overdue" }), ["copyLink", "resend", "void"]);
  assert.deepEqual(rowActions({ status: "paid" }), ["receipt"]);
  assert.deepEqual(rowActions({ status: "void" }), ["delete"]);
});

test("due chips", () => {
  assert.equal(dueDateForChip("receipt", NOW), "2026-10-26");
  assert.equal(dueDateForChip("7", NOW), "2026-11-02");
  assert.equal(dueDateForChip("14", NOW), "2026-11-09");
  assert.equal(dueDateForChip("30", NOW), "2026-11-25");
});

test("composer blocks Send on zero/negative amounts or missing client", () => {
  assert.deepEqual(composerProblems({ lines: [{ amountCents: 1000, quantity: 1 }], clientEmail: "a@b.c" }), []);
  assert.ok(composerProblems({ lines: [{ amountCents: 0, quantity: 1 }], clientEmail: "a@b.c" }).length);
  assert.ok(composerProblems({ lines: [{ amountCents: -500, quantity: 1 }], clientEmail: "a@b.c" }).length);
  assert.ok(composerProblems({ lines: [{ amountCents: 500, quantity: 0 }], clientEmail: "a@b.c" }).length);
  assert.ok(composerProblems({ lines: [], clientEmail: "a@b.c" }).length);
  assert.ok(composerProblems({ lines: [{ amountCents: 500, quantity: 1 }] }).length);
});

test("composer UI: one screen, no Review step, confirm text, idempotent request id, discard confirm", () => {
  const src = read("components/admin/invoicing/InvoiceComposer.jsx");
  assert.doesNotMatch(src, /Review/);
  assert.match(src, /Send <b>\{money\(total, currency\)\}<\/b> to <b[^>]*>\{client\.email\}<\/b>, due/);
  assert.match(src, /requestId: requestId\.current/);
  assert.match(src, /disabled=\{Boolean\(busy\)/);
  assert.match(src, /Discard changes\?/);
  assert.match(src, /Retry/);
  assert.match(src, /data-testid="composer-client-name"/);
  assert.match(src, /localStorage/);
});

test("list UI: drawer shows Stripe ids only there; void/delete confirmed", () => {
  const list = read("components/admin/InvoicesSection.jsx");
  assert.doesNotMatch(list, /stripeInvoiceId|stripe_invoice_id|customerId/);
  assert.match(read("components/admin/invoicing/InvoiceDrawer.jsx"), /invoice-stripe-ids/);
  assert.match(list, /case 'void'/); assert.match(list, /case 'delete'/);
  assert.match(list, /Stripe keeps a \$0 voided record/);
});

test("detail/edit/resend routes are admin-gated", () => {
  assert.match(read("pages/api/admin/invoicing/invoices/[id]/index.js"), /requireAdmin\(req, res, \["GET", "PATCH", "DELETE"\]\)/);
  assert.match(read("pages/api/admin/invoicing/invoices/[id]/resend.js"), /requireAdmin\(req, res, \["POST"\]\)/);
  assert.match(read("supabase/migrations/20261027020000_invoice_ux_audit.sql"), /'edit_draft','resend'/);
});

test("custom items: composer problems + UI offers custom option everywhere", () => {
  assert.deepEqual(composerProblems({ lines: [{ custom: true, description: "Web dev", amountCents: 100, quantity: 1 }], clientEmail: "a@b.c" }), []);
  assert.ok(composerProblems({ lines: [{ custom: true, description: "", amountCents: 100, quantity: 1 }], clientEmail: "a@b.c" }).length);
  assert.ok(composerProblems({ lines: [{ custom: true, description: "x", amountCents: 0, quantity: 1 }], clientEmail: "a@b.c" }).length);
  const src = read("components/admin/invoicing/InvoiceComposer.jsx");
  assert.match(src, /\+ Add custom item/);
  assert.match(src, /No products match\. Add it as a custom item/);
  assert.match(src, /custom: Boolean\(l\.custom\)/);
  assert.match(read("components/admin/invoicing/InvoiceDrawer.jsx"), /l\.custom/);
  assert.match(read("pages/api/admin/invoicing/invoices/[id]/index.js"), /metadata\?\.custom === "1"/);
});

import { addProductLine, canInvoiceAiRow, canInvoiceUserRow, emailRecipientRef, isValidEmail, oneTimeEmailOffer, parseRecipientRef, recipientRefusal } from "../../libs/invoicing/core.mjs";
import { listClient, publicInvoice } from "../../libs/invoicing/publicInvoice.mjs";

test("recipient refs: user uuid, ai:<id>, email:<addr>; junk rejected", () => {
  assert.deepEqual(parseRecipientRef("6f1c2b1e-1111-4222-8333-944445555666"), { kind: "user", id: "6f1c2b1e-1111-4222-8333-944445555666" });
  assert.deepEqual(parseRecipientRef("ai:alpha-and-omega"), { kind: "ai", id: "alpha-and-omega" });
  assert.deepEqual(parseRecipientRef("email:Pat@Example.com"), { kind: "email", id: "pat@example.com" });
  for (const bad of ["", "ai:", "ai:../x", "ai:a,b", "email:nope", "email:a@b", "123", "ai:A B"]) assert.equal(parseRecipientRef(bad), null, bad);
  assert.equal(emailRecipientRef(" A@B.co "), "email:a@b.co");
});

test("admins refused as user recipients; AI clients and typed admin emails allowed", () => {
  const isAdmin = (e) => /@sleepysquid\.com$/.test(e) || e === "lawmbass1@gmail.com";
  assert.match(recipientRefusal({ kind: "user", role: "admin", email: "x@y.com" }, isAdmin), /Admins can't be invoiced/);
  assert.match(recipientRefusal({ kind: "user", role: "client", email: "lawmbass1@gmail.com" }, isAdmin), /Admins/);
  assert.match(recipientRefusal({ role: "client", email: "a@sleepysquid.com" }, isAdmin), /Admins/);
  assert.equal(recipientRefusal({ kind: "user", role: "client", email: "c@x.com" }, isAdmin), null);
  assert.equal(recipientRefusal({ kind: "ai", role: "client", email: "admin@alphaandomegasolutions.org" }, isAdmin), null);
  assert.equal(recipientRefusal({ kind: "email", email: "lawmbass1@gmail.com" }, isAdmin), null);
  assert.match(recipientRefusal({ kind: "ai", email: null }, isAdmin), /no email/);
  assert.match(recipientRefusal(null), /not found/);
});

test("Users list: New invoice only on client rows and live AI clients with an email", () => {
  assert.equal(canInvoiceUserRow({ id: "u", role: "client", email: "c@x.com" }), true);
  assert.equal(canInvoiceUserRow({ id: "u", role: "user", email: "c@x.com" }), true);
  assert.equal(canInvoiceUserRow({ id: "u", role: "admin", email: "a@x.com" }), false);
  assert.equal(canInvoiceUserRow({ id: "u", role: "client", email: "a@sleepysquid.com" }), false);
  assert.equal(canInvoiceUserRow({ id: "u", role: "client", isPendingInvitation: true }), false);
  assert.equal(canInvoiceAiRow({ id: "alpha", emails: ["admin@alphaandomegasolutions.org"] }), true);
  assert.equal(canInvoiceAiRow({ id: "alpha", emails: [] }), false);
  assert.equal(canInvoiceAiRow({ id: "alpha", emails: ["a@b.co"], deleted_at: "2026-01-01" }), false);
  const ul = read("components/admin/UsersList.jsx");
  assert.equal((ul.match(/canInvoiceUserRow\(user\)/g) || []).length, 2);
  assert.equal((ul.match(/data-testid="ai-new-invoice"/g) || []).length, 2);
});

test("one-time email offer: valid email that matches no result", () => {
  assert.equal(isValidEmail("pat@example.com"), true);
  assert.equal(isValidEmail("pat@example"), false);
  assert.equal(oneTimeEmailOffer("Pat@Example.com", []), "pat@example.com");
  assert.equal(oneTimeEmailOffer("pat@example.com", [{ email: "PAT@example.com" }]), null);
  assert.equal(oneTimeEmailOffer("pat", []), null);
  const src = read("components/admin/invoicing/InvoiceComposer.jsx");
  assert.match(src, /\+ Invoice \{offer\}/);
  assert.match(src, /Name \(optional\)/);
  assert.match(src, /email: 'One-time'/);
  assert.match(src, /ai: 'AI client'/);
  assert.match(src, /\/api\/admin\/invoicing\/recipients/);
});

test("list rows: AI client and One-time recipients get a client + kind", () => {
  assert.equal(publicInvoice({ recipient_email: "p@x.com" }).recipientKind, "email");
  assert.deepEqual(listClient({ recipient_email: "p@x.com", recipient_name: "Pat" }), { id: "email:p@x.com", name: "Pat", email: "p@x.com", kind: "email" });
  assert.equal(listClient({ ai_client_id: "alpha" }, { alpha: { id: "ai:alpha", name: "Alpha", email: "a@b.co", kind: "ai" } }).name, "Alpha");
  assert.equal(listClient({ client: { id: "u", name: "Ann", email: "a@x.com" } }).kind, "user");
  assert.match(read("components/admin/InvoicesSection.jsx"), /RecipientTag kind=\{inv\.client\?\.kind\}/);
});

test("migration: nullable ai_client_id + recipient_email/name, recipient check", () => {
  const sql = read("supabase/migrations/20261027030000_invoice_recipients.sql");
  for (const re of [/ADD COLUMN IF NOT EXISTS ai_client_id text/, /ADD COLUMN IF NOT EXISTS recipient_email text/, /ADD COLUMN IF NOT EXISTS recipient_name text/, /user_id DROP NOT NULL/, /user_id IS NOT NULL OR ai_client_id IS NOT NULL OR recipient_email IS NOT NULL/]) assert.match(sql, re);
  const route = read("pages/api/admin/invoicing/clients/[id]/invoices.js");
  assert.match(route, /status\(400\)\.json\(\{ error: "Invalid recipient"/);
  assert.match(route, /ensureCustomerByEmail/);
});

test("TEST badge only in test mode; no LIVE badge", () => {
  const src = read("components/admin/invoicing/shared.js");
  assert.doesNotMatch(src, /LIVE/);
  assert.match(src, /if \(mode !== 'test'\) return null;/);
});

test("line items: picking an added product bumps qty instead of duplicating", () => {
  const p = { priceId: "price_d", unitAmount: 25000, currency: "usd", product: { name: "Drone shoot" } };
  let ls = addProductLine([], p, "k1");
  assert.equal(ls.length, 1); assert.equal(ls[0].quantity, "1"); assert.equal(ls[0].amount, "250.00");
  ls = addProductLine(ls, p, "k2");
  assert.equal(ls.length, 1); assert.equal(ls[0].quantity, "2");
  ls = addProductLine([{ key: "c", custom: true, priceId: null, quantity: "1" }], { ...p, priceId: "price_e" }, "k3");
  assert.equal(ls.length, 2);
  const src = read("components/admin/invoicing/InvoiceComposer.jsx");
  for (const re of [/data-testid="lines-header"/, /\+ Add item/, /data-testid="product-added">added/, /Subtotal/, /e\.key === 'Enter'/, /ref\.current\?\.focus\(\)/, /col-span-4 sm:col-span-1/]) assert.match(src, re);
  assert.doesNotMatch(src, /title="Remove line"/);
});
