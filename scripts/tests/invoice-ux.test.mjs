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
