import React, { useCallback, useEffect, useRef, useState } from 'react';

const money = (cents, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100);
const NOT_MIGRATED_NOTE = 'Invoicing database tables are not set up yet (migration not applied), so drafts can\'t be saved. You can still browse products and build the invoice.';
export const LINE_LABEL = { drones: 'Drones', ai: 'AI automation', web: 'Website' };
const STATUS_CHIP = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  void: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200',
  uncollectible: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};
const STATUS_LABEL = { open: 'Open / unpaid', overdue: 'Overdue', paid: 'Paid', draft: 'Draft', void: 'Void', uncollectible: 'Uncollectible' };
const btn = 'px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50';
const input = 'block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm';
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-req`);

async function api(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export function ModeBadge({ mode }) {
  if (!mode || mode === 'none') return null;
  const live = mode === 'live';
  return (
    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${live ? 'bg-red-600 text-white' : 'bg-yellow-300 text-yellow-900'}`}>
      {live ? 'LIVE' : 'TEST'}
    </span>
  );
}

function NewInvoice({ userId, client, catalog, migrated, onDone, onCancel }) {
  const [error, setError] = useState('');
  const [lines, setLines] = useState([]);
  const [memo, setMemo] = useState('');
  const [dueDate, setDueDate] = useState(catalog?.defaultDueDate || '');
  const [step, setStep] = useState('edit');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newId());


  const prices = (catalog?.products || []).flatMap((p) => p.prices.map((pr) => ({ ...pr, product: p })));
  const addLine = (priceId) => {
    const hit = prices.find((p) => p.priceId === priceId);
    if (!hit) return;
    setLines((ls) => [...ls, { priceId, description: hit.product.name, amount: (hit.unitAmount / 100).toFixed(2), currency: hit.currency, businessLine: hit.product.businessLine }]);
  };
  const total = lines.reduce((s, l) => s + Math.round(Number(l.amount || 0) * 100), 0);
  const currency = lines[0]?.currency || 'usd';
  const valid = lines.length > 0 && lines.every((l) => Number(l.amount) > 0) && dueDate;

  const createDraft = async () => {
    if (migrated === false) { setError(NOT_MIGRATED_NOTE); return; }
    setBusy(true); setError('');
    const { ok, body } = await api(`/api/admin/invoicing/clients/${userId}/invoices`, {
      method: 'POST',
      body: JSON.stringify({ requestId: requestId.current, memo, dueDate, lines: lines.map((l) => ({ priceId: l.priceId, description: l.description, amountCents: Math.round(Number(l.amount) * 100) })) }),
    });
    setBusy(false);
    if (!ok) { setError(body.message || 'Could not create the draft'); requestId.current = newId(); return; }
    onDone(body.data.invoice);
  };

  if (!catalog.writesAllowed) return <p className="text-sm text-amber-700">Invoicing is turned off for this Stripe key (live mode not approved yet).</p>;
  if (catalog.products.length === 0) return <p className="text-sm text-amber-700">No Stripe products are tagged service = drones, ai or web yet.</p>;

  if (step === 'review') {
    return (
      <div className="space-y-2 text-sm text-gray-800 dark:text-gray-100">
        <h5 className="font-semibold">Review draft<ModeBadge mode={catalog.mode} /></h5>
        <p><span className="text-gray-500">Client:</span> {client.name || '—'} &lt;{client.email}&gt;</p>
        <table className="w-full"><tbody>
          {lines.map((l, i) => (<tr key={i}><td>{l.description} <span className="text-xs text-gray-500">({LINE_LABEL[l.businessLine]})</span></td><td className="text-right">{money(Math.round(Number(l.amount) * 100), l.currency)}</td></tr>))}
          <tr className="font-semibold border-t"><td>Total</td><td className="text-right">{money(total, currency)}</td></tr>
        </tbody></table>
        <p><span className="text-gray-500">Due:</span> {dueDate}</p>
        <p><span className="text-gray-500">Message to client:</span> {memo || '—'}</p>
        <p className="text-xs text-gray-500">This creates a draft in Stripe. Nothing is sent to the client until you click Send.</p>
        {error && <p className="text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={`${btn} border`} disabled={busy} onClick={() => setStep('edit')}>Back</button>
          <button type="button" className={`${btn} bg-blue-600 text-white`} disabled={busy || migrated === false} title={migrated === false ? NOT_MIGRATED_NOTE : undefined} onClick={createDraft}>{busy ? 'Creating…' : 'Create draft'}</button>
          {migrated === false && <p className="text-sm text-amber-700 w-full">{NOT_MIGRATED_NOTE}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <select className={input} defaultValue="" onChange={(e) => { addLine(e.target.value); e.target.value = ''; }} aria-label="Add product">
          <option value="" disabled>Add a product…</option>
          {catalog.products.map((p) => (
            <optgroup key={p.productId} label={`${LINE_LABEL[p.businessLine]} · ${p.name}`}>
              {p.prices.map((pr) => <option key={pr.priceId} value={pr.priceId}>{p.name}{pr.nickname ? ` – ${pr.nickname}` : ''} ({money(pr.unitAmount, pr.currency)})</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input className={input} value={l.description} maxLength={200} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} aria-label="Line description" />
          <input className={`${input} w-28`} type="number" min="0.01" step="0.01" value={l.amount} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} aria-label="Amount" />
          <button type="button" className="text-red-600 text-xs" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <label className="block">Message to client (memo)<textarea className={input} maxLength={500} rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} /></label>
      <label className="block">Due date<input className={input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      <div className="flex gap-2 items-center">
        <span className="font-semibold">Total {money(total, currency)}</span>
        <div className="flex-1" />
        <button type="button" className={`${btn} border`} onClick={onCancel}>Cancel</button>
        <button type="button" className={`${btn} bg-blue-600 text-white`} disabled={!valid} onClick={() => setStep('review')}>Review</button>
      </div>
    </div>
  );
}

export function InvoiceRow({ inv, client, onChanged }) {
  const [confirm, setConfirm] = useState(null); // 'send' | 'void'
  const [confirmedAt, setConfirmedAt] = useState(0);
  const [reapprove, setReapprove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const doSend = async () => {
    setBusy(true); setError('');
    const { ok, status, body } = await api(`/api/admin/invoicing/invoices/${inv.id}/send`, {
      method: 'POST', body: JSON.stringify({ confirmEmail: client.email, confirmedAt, reapproveTotalCents: reapprove?.currentTotalCents }),
    });
    setBusy(false);
    if (status === 409 && body.error === 'needs_reapproval') { setReapprove(body.data); setConfirm('send'); setConfirmedAt(0); return; }
    if (!ok) { setError(body.message || 'Could not send'); return; }
    setConfirm(null); setReapprove(null); onChanged();
  };
  const doVoid = async () => {
    setBusy(true); setError('');
    const { ok, body } = await api(`/api/admin/invoicing/invoices/${inv.id}/void`, { method: 'POST', body: JSON.stringify({ confirm: 'VOID' }) });
    setBusy(false);
    if (!ok) { setError(body.message || 'Could not void'); return; }
    setConfirm(null); onChanged();
  };

  return (
    <li className="py-2 text-sm text-gray-800 dark:text-gray-100">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CHIP[inv.status] || STATUS_CHIP.draft}`}>{STATUS_LABEL[inv.status] || inv.status}</span>
        <span className="font-medium">{money(inv.totalCents, inv.currency)}</span>
        <span className="text-gray-500">{inv.number || 'Draft'} · due {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</span>
        {!inv.livemode && <ModeBadge mode="test" />}
        <span className="flex-1" />
        {inv.hostedInvoiceUrl && <a className="text-blue-600 underline" href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer">Invoice</a>}
        {inv.invoicePdf && <a className="text-blue-600 underline" href={inv.invoicePdf} target="_blank" rel="noreferrer">PDF</a>}
        {inv.rawStatus === 'draft' && <button type="button" className={`${btn} bg-blue-600 text-white`} disabled={busy} onClick={() => { setConfirm('send'); setConfirmedAt(0); }}>Send invoice to {client.email}</button>}
        {['draft', 'open', 'uncollectible'].includes(inv.rawStatus) && <button type="button" className={`${btn} border border-red-300 text-red-700`} disabled={busy} onClick={() => setConfirm('void')}>{inv.rawStatus === 'draft' ? 'Discard draft' : 'Void'}</button>}
      </div>
      {inv.lastPaymentError && <p className="text-xs text-red-600">Last payment failed: {inv.lastPaymentError}</p>}
      {confirm === 'send' && (
        <div className="mt-2 p-2 rounded border border-blue-300 bg-blue-50 dark:bg-blue-900/20">
          {reapprove
            ? <p>The amount changed since review: was {money(reapprove.approvedTotalCents, inv.currency)}, now <b>{money(reapprove.currentTotalCents, inv.currency)}</b>. Approve the new total to send.</p>
            : <p>Send {money(inv.totalCents, inv.currency)} to <b>{client.email}</b>? Stripe will email the invoice now.</p>}
          {!confirmedAt
            ? <button type="button" className={`${btn} bg-blue-600 text-white mt-1`} onClick={() => setConfirmedAt(Date.now())}>{reapprove ? 'Approve new total' : 'Yes, I checked it'}</button>
            : <button type="button" className={`${btn} bg-blue-700 text-white mt-1`} disabled={busy} onClick={doSend}>{busy ? 'Sending…' : `Send invoice to ${client.email}`}</button>}
          <button type="button" className={`${btn} ml-2`} disabled={busy} onClick={() => { setConfirm(null); setReapprove(null); }}>Cancel</button>
        </div>
      )}
      {confirm === 'void' && (
        <div className="mt-2 p-2 rounded border border-red-300 bg-red-50 dark:bg-red-900/20">
          <p>{inv.rawStatus === 'draft' ? 'Discard this draft? It was never sent.' : `Void ${inv.number || 'this invoice'} for ${money(inv.totalCents, inv.currency)}? The client can no longer pay it. This cannot be undone.`}</p>
          <button type="button" className={`${btn} bg-red-600 text-white mt-1`} disabled={busy} onClick={doVoid}>{busy ? 'Working…' : 'Yes, void'}</button>
          <button type="button" className={`${btn} ml-2`} disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

export default function ClientInvoices({ userId, startCreating = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(startCreating);
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const load = useCallback(async () => {
    const { ok, body } = await api(`/api/admin/invoicing/clients/${userId}/invoices`);
    if (!ok) { setError(body.message || 'Could not load invoices'); return; }
    setError(''); setData(body.data);
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api('/api/admin/invoicing/products').then(({ ok, body }) => {
      if (!ok) return setCatalogError(body.message || 'Could not load products');
      setCatalog(body.data);
    });
  }, []);
  const mode = data?.mode || catalog?.mode;
  const migrated = data ? data.migrated !== false : undefined;

  return (
    <section className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex items-center mb-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Invoices<ModeBadge mode={mode} /></h4>
        <span className="flex-1" />
        {!creating && catalog && <button type="button" className={`${btn} bg-blue-600 text-white`} onClick={() => setCreating(true)}>New invoice</button>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {migrated === false && <p className="text-sm text-amber-700 mb-2" data-testid="invoicing-not-migrated">{NOT_MIGRATED_NOTE}</p>}
      {catalogError && <p className="text-sm text-red-600">{catalogError}</p>}
      {!catalog && !catalogError && <p className="text-sm text-gray-500">Loading products…</p>}
      {creating && catalog && <NewInvoice userId={userId} client={data?.client || {}} catalog={catalog} migrated={migrated} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} />}
      {data && (data.invoices.length === 0
        ? !creating && <p className="text-sm text-gray-500">No invoices yet.</p>
        : <ul className="divide-y divide-gray-200 dark:divide-gray-700">{data.invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} client={data.client} onChanged={load} />)}</ul>)}
    </section>
  );
}
