import { displayStatus } from "./core.mjs";

export function publicInvoice(row) {
  return {
    id: row.id, stripeInvoiceId: row.stripe_invoice_id, number: row.number, status: displayStatus(row), rawStatus: row.status,
    livemode: row.livemode, currency: row.currency, totalCents: Number(row.total_cents), amountDueCents: Number(row.amount_due_cents),
    dueDate: row.due_date, memo: row.memo, hostedInvoiceUrl: row.hosted_invoice_url, invoicePdf: row.invoice_pdf,
    approvedTotalCents: row.approved_total_cents == null ? null : Number(row.approved_total_cents),
    lastPaymentError: row.last_payment_error, sentAt: row.sent_at, createdAt: row.created_at, businessLines: row.business_lines || [],
  };
}

