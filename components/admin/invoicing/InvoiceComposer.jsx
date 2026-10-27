import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addProductLine, composerProblems, dueDateForChip, emailRecipientRef, oneTimeEmailOffer } from '@/libs/invoicing/ui.mjs';
import { api, btn, ConfirmDialog, fmtDate, input, LINE_LABEL, ModeBadge, money, newId } from './shared';

const DUE_CHIPS = [['receipt', 'On receipt'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days']];
const DUE_KEY = 'ssq.invoiceDueChip';
const toCents = (v) => Math.round(Number(String(v).replace(/[$,\s]/g, '')) * 100);

const KIND_TAG = { ai: 'AI client', email: 'One-time' };
export function RecipientTag({ kind }) {
  if (!KIND_TAG[kind]) return null;
  return <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${kind === 'ai' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`} data-testid={`recipient-tag-${kind}`}>{KIND_TAG[kind]}</span>;
}

function ClientTypeahead({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [oneTimeName, setOneTimeName] = useState('');
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const { body } = await api(`/api/admin/invoicing/recipients?${new URLSearchParams(q.trim() ? { q: q.trim() } : {})}`);
      setResults(body?.data?.recipients || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);
  const offer = loading ? null : oneTimeEmailOffer(q, results);
  return (
    <div data-testid="composer-client-search">
      <input autoFocus className={input} placeholder="Client name, email or company" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Client" />
      <ul className="mt-1 max-h-72 overflow-auto rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {results.map((u) => (
          <li key={u.id}>
            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700" onClick={() => onPick({ id: u.id, name: u.name, email: u.email, kind: u.kind })}>
              <span className="font-medium">{u.name || u.email}</span><RecipientTag kind={u.kind} /> <span className="text-gray-500 break-all">{u.email}</span>
            </button>
          </li>
        ))}
        {loading && <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>}
        {!loading && results.length === 0 && !offer && <li className="px-3 py-2 text-sm text-gray-500">No matching clients. Type a full email to send a one-time invoice.</li>}
        {offer && (
          <li className="px-3 py-2 space-y-2 bg-amber-50/50 dark:bg-gray-800" data-testid="onetime-offer">
            <input className={input} placeholder="Name (optional)" value={oneTimeName} maxLength={120} onChange={(e) => setOneTimeName(e.target.value)} aria-label="Recipient name" />
            <button type="button" data-testid="onetime-invoice" className="w-full text-left text-sm text-blue-700 dark:text-blue-300 font-medium break-all" onClick={() => onPick({ id: emailRecipientRef(offer), name: oneTimeName.trim() || null, email: offer, kind: 'email' })}>
              + Invoice {offer}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Inline "+ Add item" row: search products, Enter picks the highlighted one, focus stays for the next.
 * Already-added products show ✓ added (picking again bumps qty). Custom item is always the last option.
 */
function ProductSearch({ prices, addedIds, onAdd, onAddCustom, onDone }) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const hits = prices.filter((p) => `${p.product.name} ${LINE_LABEL[p.product.businessLine] || ''}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12);
  const options = [...hits.map((p) => ({ p })), { custom: true }];
  const pick = (o) => {
    if (o.custom) { onAddCustom(q.trim()); setQ(''); onDone(); return; }
    onAdd(o.p); setQ(''); setHi(0); ref.current?.focus();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(options[Math.min(hi, options.length - 1)]); }
    else if (e.key === 'Escape') { e.preventDefault(); onDone(); }
  };
  return (
    <div className="relative px-2 py-2 border-t border-gray-100 dark:border-gray-700" data-testid="composer-product-search">
      <input ref={ref} autoFocus className={input} placeholder="Search products or type a custom item…" value={q} onKeyDown={onKey}
        onBlur={() => setTimeout(() => { if (document.activeElement !== ref.current) onDone(); }, 200)}
        onChange={(e) => { setQ(e.target.value); setHi(0); }} aria-label="Add a product" />
      <ul className="absolute left-2 right-2 z-20 mt-1 max-h-64 overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg" role="listbox">
        {hits.map((p, i) => {
          const added = addedIds.has(p.priceId);
          return (
            <li key={p.priceId} role="option" aria-selected={hi === i}>
              <button type="button" data-testid="product-option" className={`w-full text-left px-3 py-2 text-sm flex gap-2 items-center ${hi === i ? 'bg-blue-50 dark:bg-gray-700' : ''}`} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick({ p })}>
                <span className="w-4 text-green-600">{added ? '✓' : ''}</span>
                <span className="flex-1 min-w-0 truncate">{p.product.name} <span className="text-xs text-gray-500">{LINE_LABEL[p.product.businessLine]}</span></span>
                {added && <span className="text-xs text-green-700" data-testid="product-added">added</span>}
                <span className="font-medium">{money(p.unitAmount, p.currency)}</span>
              </button>
            </li>
          );
        })}
        {hits.length === 0 && <li className="px-3 py-2 text-sm text-gray-500" data-testid="product-search-empty">No products match. Add it as a custom item instead:</li>}
        <li className="border-t border-gray-100 dark:border-gray-700" role="option" aria-selected={hi === hits.length}>
          <button type="button" data-testid="product-search-custom" className={`w-full text-left px-3 py-2 text-sm text-blue-700 dark:text-blue-300 break-words ${hi === hits.length ? 'bg-blue-50 dark:bg-gray-700' : ''}`} onMouseEnter={() => setHi(hits.length)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick({ custom: true })}>
            + Add custom item{q.trim() ? <>: <span className="font-medium">&lsquo;{q.trim()}&rsquo;</span></> : ''}
          </button>
        </li>
      </ul>
    </div>
  );
}

const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>;
const ROW_GRID = 'grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(4.5rem,auto)_2.25rem] sm:grid-cols-[minmax(0,1fr)_4rem_7rem_6.5rem_2.25rem] gap-x-2 gap-y-1 items-center';

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
  const [lines, setLines] = useState(() => (draft?.lines || []).map((l) => ({ key: newId(), custom: Boolean(l.custom || !l.priceId), priceId: l.custom ? null : l.priceId, description: l.description, amount: ((l.unitAmountCents || 0) / 100).toFixed(2), quantity: String(l.quantity || 1), currency: draft.invoice.currency })));
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
  const addLine = (p) => setLines((ls) => addProductLine(ls, p, newId()));
  const [adding, setAdding] = useState(false);
  const addedIds = useMemo(() => new Set(lines.filter((l) => !l.custom).map((l) => l.priceId)), [lines]);
  const addCustomLine = (text) => setLines((ls) => [...ls, { key: newId(), custom: true, priceId: null, description: text || '', amount: '', quantity: '1', currency: 'usd', focus: true }]);
  const patchLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const payload = () => ({ requestId: requestId.current, memo, dueDate, lines: centsLines.map((l) => ({ custom: Boolean(l.custom), priceId: l.custom ? null : l.priceId, description: l.description, amountCents: l.amountCents, quantity: l.quantity })) });

  /** Create or update the Stripe draft. Returns the saved invoice, or null on error (input kept). */
  const save = async () => {
    if (!unsaved) return savedInvoice;
    const { ok, status, body } = savedInvoice
      ? await api(`/api/admin/invoicing/invoices/${savedInvoice.id}`, { method: 'PATCH', body: JSON.stringify(payload()) })
      : await api(`/api/admin/invoicing/clients/${encodeURIComponent(client.id)}/invoices`, { method: 'POST', body: JSON.stringify({ ...payload(), ...(client.kind === 'email' ? { recipientName: client.name || '' } : {}) }) });
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" data-testid="composer-client-name">{title}<RecipientTag kind={client?.kind} /></h3>
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
          <div className="rounded border border-gray-200 dark:border-gray-700" data-testid="composer-lines-table">
            <div className={`${ROW_GRID} hidden sm:grid px-2 py-1.5 bg-gray-50 dark:bg-gray-800 text-xs font-medium uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700`} data-testid="lines-header">
              <span>Item</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span><span />
            </div>
            <ul data-testid="composer-lines">
              {lines.map((l) => (
                <li key={l.key} className={`${ROW_GRID} px-2 py-2 border-b last:border-b-0 border-gray-100 dark:border-gray-700`} data-testid="composer-line">
                  <div className="col-span-4 sm:col-span-1 flex items-center gap-1 min-w-0">
                    {l.custom && <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-800 shrink-0" data-testid="custom-badge">Custom</span>}
                    <input className={`${input} min-w-0`} value={l.description} maxLength={200} autoFocus={Boolean(l.custom && l.focus && !l.description)} placeholder={l.custom ? 'Describe the work' : 'Description'} onChange={(e) => patchLine(l.key, { description: e.target.value })} aria-label="Description" />
                  </div>
                  <input className={`${input} text-right`} inputMode="numeric" value={l.quantity} onChange={(e) => patchLine(l.key, { quantity: e.target.value.replace(/[^0-9]/g, '') })} aria-label="Quantity" />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input className={`${input} pl-5 text-right`} inputMode="decimal" value={l.amount} autoFocus={Boolean(l.custom && l.focus && l.description)} placeholder="0.00" onChange={(e) => patchLine(l.key, { amount: e.target.value })} aria-label="Unit price" />
                  </div>
                  <span className="text-sm font-medium text-right tabular-nums" data-testid="line-total">{money(Math.max(0, toCents(l.amount) || 0) * (Number(l.quantity) || 0), l.currency)}</span>
                  <button type="button" className="h-9 w-9 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.description || 'line'}`}><TrashIcon /></button>
                </li>
              ))}
            </ul>
            {lines.length === 0 && !adding && <p className="px-2 py-3 text-sm text-gray-500">No items yet.</p>}
            {catalog && adding && <ProductSearch prices={prices} addedIds={addedIds} onAdd={addLine} onAddCustom={(t) => { addCustomLine(t); }} onDone={() => setAdding(false)} />}
            {catalog && !adding && (
              <button type="button" data-testid="add-item" className="w-full text-left px-2 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-700" onClick={() => setAdding(true)}>+ Add item</button>
            )}
          </div>
          <dl className="ml-auto w-full sm:w-64 text-sm space-y-1" data-testid="composer-totals">
            <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="tabular-nums" data-testid="composer-subtotal">{money(total, currency)}</dd></div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(total, currency)}</dd></div>
          </dl>

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
