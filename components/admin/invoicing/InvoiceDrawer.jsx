import React, { useEffect, useState } from 'react';
import { api, btn, CHIP_CLASS, fmtDate, money } from './shared';
import { STATUS_CHIP_LABEL } from '@/libs/invoicing/ui.mjs';

/** Right-side drawer (full screen on phones) with lines, timeline and Stripe ids. */
export default function InvoiceDrawer({ invoiceId, onClose, onEdit, onNewForClient }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api(`/api/admin/invoicing/invoices/${invoiceId}`).then(({ ok, body }) => { if (!live) return; if (ok) setData(body.data); else setError(body.message || 'Could not load the invoice'); });
    return () => { live = false; };
  }, [invoiceId]);
  const inv = data?.invoice;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose} data-testid="invoice-drawer">
      <aside className="h-full w-full sm:max-w-md overflow-y-auto bg-white dark:bg-gray-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500">{inv?.number || 'Draft invoice'}</p>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{data?.client?.name || data?.client?.email || 'Invoice'}</h3>
            {data?.client?.name && <p className="text-sm text-gray-500 break-all">{data.client.email}</p>}
          </div>
          <button type="button" className={`${btn} border border-gray-300 dark:border-gray-600`} onClick={onClose}>Close</button>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="mt-4 text-sm text-gray-500">Loading…</p>}
        {inv && (
          <div className="mt-4 space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHIP_CLASS[inv.status] || CHIP_CLASS.draft}`}>{STATUS_CHIP_LABEL[inv.status] || inv.status}</span>
              <span className="text-xl font-semibold">{money(inv.totalCents, inv.currency)}</span>
              <span className="text-gray-500">due {fmtDate(inv.dueDate)}</span>
            </div>
            <section>
              <h4 className="font-semibold mb-1">Lines</h4>
              {data.linesError && <p className="text-amber-700">{data.linesError}</p>}
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data.lines || []).map((l, i) => (
                  <li key={i} className="py-1.5 flex gap-2"><span className="flex-1 min-w-0">{l.custom && <span className="mr-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-800">Custom</span>}{l.description}{l.quantity > 1 && <span className="text-gray-500"> × {l.quantity}</span>}</span><span>{money(l.amountCents, inv.currency)}</span></li>
                ))}
              </ul>
              {inv.memo && <p className="mt-2 text-gray-600 dark:text-gray-300">Memo: {inv.memo}</p>}
            </section>
            <section>
              <h4 className="font-semibold mb-1">Timeline</h4>
              <ol className="border-l border-gray-200 dark:border-gray-700 pl-3 space-y-1.5" data-testid="invoice-timeline">
                {data.timeline.map((t, i) => <li key={i}><span className="text-gray-500">{new Date(t.at).toLocaleString()}</span> · {t.label}{t.by && <span className="text-gray-500"> by {t.by}</span>}</li>)}
              </ol>
            </section>
            <section>
              <h4 className="font-semibold mb-1">Stripe</h4>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs break-all" data-testid="invoice-stripe-ids">
                <dt className="text-gray-500">Invoice</dt><dd>{data.stripe.invoiceId}</dd>
                <dt className="text-gray-500">Customer</dt><dd>{data.stripe.customerId}</dd>
              </dl>
            </section>
            <div className="flex flex-wrap gap-2">
              {inv.rawStatus === 'draft' && <button type="button" className={`${btn} bg-blue-600 text-white`} onClick={() => onEdit(data)}>Edit draft</button>}
              {inv.hostedInvoiceUrl && <a className={`${btn} border border-gray-300 dark:border-gray-600`} href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">Open in Stripe page</a>}
              {data.client && <button type="button" className={`${btn} border border-gray-300 dark:border-gray-600`} onClick={() => onNewForClient(data.client)}>New invoice for this client</button>}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
