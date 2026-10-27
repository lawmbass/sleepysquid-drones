import React, { useEffect, useMemo, useRef, useState } from 'react';
import { composerProblems, dueDateForChip } from '@/libs/invoicing/ui.mjs';
import { api, btn, ConfirmDialog, fmtDate, input, LINE_LABEL, ModeBadge, money, newId } from './shared';

const DUE_CHIPS = [['receipt', 'On receipt'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days']];
const DUE_KEY = 'ssq.invoiceDueChip';
const toCents = (v) => Math.round(Number(String(v).replace(/[$,\s]/g, '')) * 100);

function ClientTypeahead({ onPick }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '8', ...(q.trim() ? { search: q.trim() } : {}) });
      const { body } = await api(`/api/admin/users?${params}`);
      setUsers((body?.data?.users || []).filter((u) => !u.isPendingInvitation && (u.id || u._id)));
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div data-testid="composer-client-search">
      <input autoFocus className={input} placeholder="Client name, email or company" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Client" />
      <ul className="mt-1 max-h-56 overflow-auto rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {users.map((u) => (
          <li key={u.id || u._id}>
            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => onPick({ id: u.id || u._id, name: u.name, email: u.email })}>
              <span className="font-medium">{u.name || u.email}</span> <span className="text-gray-500 break-all">{u.email}</span>
            </button>
          </li>
        ))}
        {loading && <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>}
        {!loading && users.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No matching clients.</li>}
      </ul>
    </div>
  );
}

function ProductSearch({ prices, onAdd }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const hits = prices.filter((p) => `${p.product.name} ${LINE_LABEL[p.product.businessLine] || ''}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12);
  return (
    <div className="relative" data-testid="composer-product-search">
      <input className={input} placeholder="Add a product… (type to search)" value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} aria-label="Add a product" />
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {hits.map((p) => (
            <li key={p.priceId}>
              <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 flex gap-2" onMouseDown={(e) => e.preventDefault()} onClick={() => { onAdd(p); setQ(''); setOpen(false); }}>
                <span className="flex-1 min-w-0 truncate">{p.product.name} <span className="text-xs text-gray-500">{LINE_LABEL[p.product.businessLine]}</span></span>
                <span className="font-medium">{money(p.unitAmount, p.currency)}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No products match.</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * One-screen create + send. Props:
 *  - lockedClient: { id, name, email } when opened from a client (locked), else null (type-ahead)
 *  - draft: { invoice, lines } when editing an existing draft
 *  - onClose(changed)
 */
export default function InvoiceComposer({ lockedClient = null, draft = null, onClose }) {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [client, setClient] = useState(lockedClient || draft?.client || null);
  const [lines, setLines] = useState(() => (draft?.lines || []).map((l) => ({ key: newId(), priceId: l.priceId, description: l.description, amount: ((l.unitAmountCents || 0) / 100).toFixed(2), quantity: String(l.quantity || 1), currency: draft.invoice.currency })));
  const [dueChip, setDueChip] = useState(null);
  const [dueDate, setDueDate] = useState(draft?.invoice?.dueDate ? draft.invoice.dueDate.slice(0, 10) : '');
  const [memo, setMemo] = useState(draft?.invoice?.memo || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null); // { message, retry }
  const [confirm, setConfirm] = useState(null); // 'send' | 'discard'
  const [savedInvoice, setSavedInvoice] = useState(draft?.invoice || null);
  const requestId = useRef(newId());
  const clientLocked = Boolean(lockedClient || draft);

  useEffect(() => {
    api('/api/admin/invoicing/products').then(({ ok, body }) => (ok ? setCatalog(body.data) : setCatalogError(body.message || 'Could not load products')));
  }, []);
  useEffect(() => {
    if (draft) return;
    let chip = '14';
    try { chip = window.localStorage.getItem(DUE_KEY) || '14'; } catch { /* ignore */ }
    setDueChip(chip); setDueDate(dueDateForChip(chip));
  }, [draft]);
  useEffect(() => { if (lockedClient) setClient(lockedClient); }, [lockedClient]);

  const prices = useMemo(() => (catalog?.products || []).flatMap((p) => p.prices.map((pr) => ({ ...pr, product: p }))), [catalog]);
  const centsLines = lines.map((l) => ({ ...l, amountCents: toCents(l.amount), quantity: Number(l.quantity) }));
  const total = centsLines.reduce((s, l) => s + (l.amountCents > 0 ? l.amountCents : 0) * (l.quantity > 0 ? l.quantity : 0), 0);
  const currency = lines[0]?.currency || 'usd';
  const problems = composerProblems({ lines: centsLines, clientEmail: client?.email });
  const formKey = JSON.stringify({ c: client?.id, l: centsLines.map((l) => [l.priceId, l.amountCents, l.quantity, l.description]), dueDate, memo });
  const [savedKey, setSavedKey] = useState(null);
  useEffect(() => { if (draft && savedKey === null) setSavedKey(formKey); }, [draft, formKey, savedKey]);
  const unsaved = !savedInvoice || formKey !== savedKey;
  const needsDiscardConfirm = savedInvoice ? unsaved : (lines.length > 0 || Boolean(memo.trim()));

  const setChip = (chip) => {
    setDueChip(chip); setDueDate(dueDateForChip(chip));
    try { window.localStorage.setItem(DUE_KEY, chip); } catch { /* ignore */ }
  };
  const addLine = (p) => setLines((ls) => [...ls, { key: newId(), priceId: p.priceId, description: p.product.name, amount: (p.unitAmount / 100).toFixed(2), quantity: '1', currency: p.currency }]);
  const patchLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const payload = () => ({ requestId: requestId.current, memo, dueDate, lines: centsLines.map((l) => ({ priceId: l.priceId, description: l.description, amountCents: l.amountCents, quantity: l.quantity })) });

  /** Create or update the Stripe draft. Returns the saved invoice, or null on error (input kept). */
  const save = async () => {
    if (!unsaved) return savedInvoice;
    const { ok, status, body } = savedInvoice
      ? await api(`/api/admin/invoicing/invoices/${savedInvoice.id}`, { method: 'PATCH', body: JSON.stringify(payload()) })
      : await api(`/api/admin/invoicing/clients/${client.id}/invoices`, { method: 'POST', body: JSON.stringify(payload()) });
    if (!ok) {
      // A definite server answer means the request is done; a network drop (status 0) keeps the same key so a retry can't double-create.
      if (status !== 0) requestId.current = newId();
      return { error: body.message || 'Stripe couldn\'t save the draft.' };
    }
    setSavedInvoice(body.data.invoice); setSavedKey(formKey);
    return body.data.invoice;
  };

  const doSave = async () => {
    if (busy) return;
    setBusy('save'); setError(null);
    const r = await save();
    setBusy('');
    if (r?.error) setError({ message: r.error, retry: doSave });
  };

  const doSend = async (reapproveTotalCents) => {
    if (busy) return;
    setBusy('send'); setError(null);
    const inv = await save();
    if (!inv || inv.error) { setBusy(''); setConfirm(null); setError({ message: inv?.error || 'Could not save', retry: () => setConfirm('send') }); return; }
    const { ok, status, body } = await api(`/api/admin/invoicing/invoices/${inv.id}/send`, {
      method: 'POST', body: JSON.stringify({ confirmEmail: client.email, confirmedAt: Date.now(), reapproveTotalCents }),
    });
    setBusy(''); setConfirm(null);
    if (status === 409 && body.error === 'needs_reapproval') {
      setError({ message: `Stripe's total is ${money(body.data.currentTotalCents, currency)}. Retry to approve and send that amount.`, retry: () => doSend(body.data.currentTotalCents) });
      return;
    }
    if (!ok) { setError({ message: body.message || 'Stripe couldn\'t send the invoice.', retry: () => setConfirm('send') }); return; }
    onClose(true);
  };

  const close = () => (needsDiscardConfirm ? setConfirm('discard') : onClose(Boolean(savedInvoice)));
  const title = client ? (client.name || client.email) : 'Pick a client';

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 p-3 sm:p-4 space-y-4 max-w-2xl" data-testid="invoice-composer">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">{draft ? 'Edit draft' : 'New invoice'}<ModeBadge mode={catalog?.mode} /></p>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" data-testid="composer-client-name">{title}</h3>
          {client?.name && <p className="text-sm text-gray-500 break-all">{client.email}</p>}
        </div>
        {client && !clientLocked && <button type="button" className={`${btn} border border-gray-300 dark:border-gray-600`} onClick={() => setClient(null)}>Change</button>}
        <button type="button" className={`${btn} border border-gray-300 dark:border-gray-600`} onClick={close} aria-label="Close">Close</button>
      </div>

      {!client && <ClientTypeahead onPick={setClient} />}

      {client && (
        <>
          {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}
          {!catalog && !catalogError && <p className="text-sm text-gray-500">Loading products…</p>}
          {catalog && !catalog.writesAllowed && <p className="text-sm text-amber-700">Invoice writes are turned off for this Stripe key.</p>}
          {catalog && <ProductSearch prices={prices} onAdd={addLine} />}

          {lines.length > 0 && (
            <ul className="space-y-2" data-testid="composer-lines">
              {lines.map((l) => (
                <li key={l.key} className="rounded border border-gray-200 dark:border-gray-700 p-2">
                  <div className="flex gap-2 items-center">
                    <input className={`${input} flex-1`} value={l.description} maxLength={200} onChange={(e) => patchLine(l.key, { description: e.target.value })} aria-label="Description" />
                    <button type="button" className="p-2 text-gray-500 hover:text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove line" title="Remove line">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_5rem_auto] gap-2 items-center">
                    <label className="text-xs text-gray-500">Amount
                      <input className={input} inputMode="decimal" value={l.amount} onChange={(e) => patchLine(l.key, { amount: e.target.value })} aria-label="Amount" />
                    </label>
                    <label className="text-xs text-gray-500">Qty
                      <input className={input} inputMode="numeric" value={l.quantity} onChange={(e) => patchLine(l.key, { quantity: e.target.value.replace(/[^0-9]/g, '') })} aria-label="Quantity" />
                    </label>
                    <span className="text-sm font-medium text-right pt-4">{money(Math.max(0, toCents(l.amount) || 0) * (Number(l.quantity) || 0), l.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Due</p>
            <div className="mt-1 flex flex-wrap gap-2 items-center">
              {DUE_CHIPS.map(([v, label]) => (
                <button key={v} type="button" onClick={() => setChip(v)} className={`px-3 py-1.5 rounded-full text-sm border ${dueChip === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>{label}</button>
              ))}
              <input type="date" className={`${input} w-auto`} value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueChip(null); }} aria-label="Due date" />
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Memo <span className="font-normal text-gray-500">(optional, shown to client)</span>
            <textarea className={input} rows={2} maxLength={500} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 dark:bg-red-900/20 p-2 text-sm text-red-700 dark:text-red-200 flex gap-2 items-center" role="alert" data-testid="composer-error">
              <span className="flex-1">{error.message}</span>
              {error.retry && <button type="button" className={`${btn} bg-red-600 text-white`} onClick={error.retry}>Retry</button>}
            </div>
          )}

          <div className="sticky bottom-0 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 items-center">
            <p className="flex-1 min-w-[8rem] text-base font-semibold" data-testid="composer-total">Total {money(total, currency)}</p>
            <button type="button" className={`${btn} border border-gray-300 dark:border-gray-600`} disabled={Boolean(busy) || !catalog?.writesAllowed || lines.length === 0 || !unsaved} onClick={doSave}>{busy === 'save' ? 'Saving…' : savedInvoice && !unsaved ? 'Saved' : 'Save draft'}</button>
            <button type="button" className={`${btn} bg-blue-600 text-white`} disabled={Boolean(busy) || !catalog?.writesAllowed || problems.length > 0} title={problems[0] || ''} onClick={() => setConfirm('send')} data-testid="composer-send">{busy === 'send' ? 'Sending…' : 'Send'}</button>
          </div>
          {problems.length > 0 && lines.length > 0 && <p className="text-xs text-red-600" data-testid="composer-problem">{problems[0]}</p>}
        </>
      )}

      {confirm === 'send' && (
        <ConfirmDialog title="Send invoice?" confirmLabel={busy === 'send' ? 'Sending…' : 'Send'} busy={Boolean(busy)} onCancel={() => setConfirm(null)} onConfirm={() => doSend()} testid="send-confirm">
          Send <b>{money(total, currency)}</b> to <b className="break-all">{client.email}</b>, due <b>{dueChip === 'receipt' ? 'on receipt' : fmtDate(dueDate)}</b>?
        </ConfirmDialog>
      )}
      {confirm === 'discard' && (
        <ConfirmDialog title="Discard changes?" confirmLabel="Discard" danger onCancel={() => setConfirm(null)} onConfirm={() => onClose(Boolean(savedInvoice))} testid="discard-confirm">
          You have unsaved changes. They will be lost.
        </ConfirmDialog>
      )}
    </div>
  );
}
