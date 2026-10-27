import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CHIP_LABEL, LIST_CHIPS, STATUS_CHIP_LABEL, daysOverdue, rowActions } from '@/libs/invoicing/ui.mjs';
import { api, btn, CHIP_CLASS, ConfirmDialog, fmtDate, input, ModeBadge, money } from './invoicing/shared';
import InvoiceComposer, { RecipientTag } from './invoicing/InvoiceComposer';
import InvoiceDrawer from './invoicing/InvoiceDrawer';

const ACTION_LABEL = { edit: 'Edit', send: 'Send', delete: 'Delete', copyLink: 'Copy pay link', resend: 'Resend', void: 'Void', receipt: 'View receipt' };

function InvoiceListRow({ inv, onOpen, onAction, copied }) {
  const late = daysOverdue(inv);
  const who = inv.client?.name || inv.client?.email || 'Unknown client';
  return (
    <li className="px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={() => onOpen(inv)} data-testid="invoice-row">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex-1 min-w-[10rem] font-medium text-gray-900 dark:text-white truncate">{who}<RecipientTag kind={inv.client?.kind} /></span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHIP_CLASS[inv.status] || CHIP_CLASS.draft}`}>{STATUS_CHIP_LABEL[inv.status] || inv.status}</span>
        <span className="font-semibold text-right sm:w-24">{money(inv.totalCents, inv.currency)}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-gray-500">Due {fmtDate(inv.dueDate)}</span>
        {late > 0 && <span className="text-red-600 font-medium" data-testid="days-overdue">{late} {late === 1 ? 'day' : 'days'} overdue</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
        {rowActions(inv).map((a) => (
          <button key={a} type="button" data-testid={`row-${a}`}
            className={`${btn} py-1 ${a === 'void' || a === 'delete' ? 'border border-red-300 text-red-700 dark:text-red-300' : a === 'send' ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600'}`}
            onClick={(e) => { e.stopPropagation(); onAction(a, inv); }}>
            {a === 'copyLink' && copied === inv.id ? 'Copied' : ACTION_LABEL[a]}
          </button>
        ))}
      </div>
    </li>
  );
}

export default function InvoicesSection() {
  const router = useRouter();
  const [status, setStatus] = useState('unpaid');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [composer, setComposer] = useState(null); // { lockedClient?, draft? }
  const [drawerId, setDrawerId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { action, inv }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(null);
  const clientId = typeof router.query.client === 'string' ? router.query.client : '';

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 250); return () => clearTimeout(t); }, [q]);
  const load = useCallback(async () => {
    const { ok, body } = await api(`/api/admin/invoicing/invoices?${new URLSearchParams({ status, q: debouncedQ })}`);
    if (!ok) { setError(body.message || 'Could not load invoices'); return; }
    setError(''); setData(body.data);
  }, [status, debouncedQ]);
  useEffect(() => { load(); }, [load]);

  // Coming from a client row (?client=<id>): open the composer with that client locked.
  useEffect(() => {
    if (!clientId) return;
    api(`/api/admin/invoicing/clients/${encodeURIComponent(clientId)}/invoices`).then(({ ok, body }) => {
      if (ok && body.data?.client) setComposer({ lockedClient: { ...body.data.client, id: clientId } });
    });
  }, [clientId]);

  const closeComposer = (changed) => {
    setComposer(null);
    if (clientId) router.push({ pathname: '/dashboard', query: { section: 'invoices' } }, undefined, { shallow: true });
    if (changed) load();
  };

  const runAction = async (action, inv) => {
    setActionError('');
    if (action === 'copyLink') {
      try { await navigator.clipboard.writeText(inv.hostedInvoiceUrl || ''); setCopied(inv.id); setTimeout(() => setCopied(null), 1500); } catch { setActionError('Could not copy the link'); }
      return;
    }
    if (action === 'receipt') { if (inv.hostedInvoiceUrl) window.open(inv.hostedInvoiceUrl, '_blank', 'noopener'); return; }
    if (action === 'edit') {
      const { ok, body } = await api(`/api/admin/invoicing/invoices/${inv.id}`);
      if (!ok) { setActionError(body.message || 'Could not open the draft'); return; }
      setComposer({ draft: { invoice: body.data.invoice, lines: body.data.lines || [], client: body.data.client } });
      return;
    }
    setConfirm({ action, inv });
  };

  const doConfirmed = async () => {
    const { action, inv } = confirm;
    setBusy(true); setActionError('');
    const req = {
      send: () => api(`/api/admin/invoicing/invoices/${inv.id}/send`, { method: 'POST', body: JSON.stringify({ confirmEmail: inv.client?.email, confirmedAt: Date.now() }) }),
      void: () => api(`/api/admin/invoicing/invoices/${inv.id}/void`, { method: 'POST', body: JSON.stringify({ confirm: 'VOID' }) }),
      delete: () => api(`/api/admin/invoicing/invoices/${inv.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }),
      resend: () => api(`/api/admin/invoicing/invoices/${inv.id}/resend`, { method: 'POST', body: JSON.stringify({ confirm: 'RESEND' }) }),
    }[action];
    const { ok, body } = await req();
    setBusy(false); setConfirm(null);
    if (!ok) { setActionError(body.message || `Could not ${action}`); return; }
    load();
  };

  const confirmText = (c) => {
    const amt = money(c.inv.totalCents, c.inv.currency);
    const email = c.inv.client?.email;
    switch (c.action) {
      case 'send': return { title: 'Send invoice?', label: 'Send', body: <>Send <b>{amt}</b> to <b className="break-all">{email}</b>, due <b>{fmtDate(c.inv.dueDate)}</b>?</> };
      case 'void': return { title: 'Void invoice?', label: 'Void', danger: true, body: <>Void {c.inv.number || 'this invoice'} for {amt}? The client can no longer pay it. This cannot be undone.</> };
      case 'delete': return { title: 'Delete invoice?', label: 'Delete', danger: true, body: c.inv.rawStatus === 'draft' ? <>Delete this draft? It is removed from this list and deleted in Stripe. It was never sent.</> : <>Delete {c.inv.number || 'this invoice'}? It is removed from this list. Stripe keeps a $0 voided record.</> };
      case 'resend': return { title: 'Resend invoice?', label: 'Resend', body: <>Email {c.inv.number || 'this invoice'} ({amt}) to <b className="break-all">{email}</b> again?</> };
      default: return { title: '', label: 'OK', body: null };
    }
  };
  const ct = confirm && confirmText(confirm);
  const counts = data?.counts || {};

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices<ModeBadge mode={data?.mode} /></h2>
        <span className="flex-1" />
        {!composer && <button type="button" className={`${btn} bg-blue-600 text-white px-4 text-base`} onClick={() => setComposer({})} data-testid="invoices-new">New invoice</button>}
      </div>

      {composer && <InvoiceComposer key={composer.draft?.invoice?.id || composer.lockedClient?.id || 'new'} lockedClient={composer.lockedClient || null} draft={composer.draft || null} onClose={closeComposer} />}

      {!composer && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" data-testid="invoice-chips">
            {LIST_CHIPS.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={status === c} onClick={() => setStatus(c)}
                className={`px-3 py-1.5 rounded-full text-sm border ${status === c ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900' : 'border-gray-300 dark:border-gray-600'}`}>
                {CHIP_LABEL[c]} <span className="opacity-70">{counts[c] ?? ''}</span>
              </button>
            ))}
          </div>
          <input className={`${input} max-w-md`} placeholder="Search client or invoice number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search invoices" data-testid="invoice-search" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {actionError && <p className="text-sm text-red-600" role="alert">{actionError}</p>}
          {data?.migrated === false && <p className="text-sm text-amber-700">{data.notice}</p>}
          {!data && !error && <p className="text-sm text-gray-500">Loading invoices…</p>}
          {data && data.invoices.length === 0 && <p className="text-sm text-gray-500">No invoices match.</p>}
          {data && data.invoices.length > 0 && (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded border border-gray-200 dark:border-gray-700" data-testid="invoice-list">
              {data.invoices.map((inv) => <InvoiceListRow key={inv.id} inv={inv} onOpen={(i) => setDrawerId(i.id)} onAction={runAction} copied={copied} />)}
            </ul>
          )}
        </>
      )}

      {drawerId && (
        <InvoiceDrawer invoiceId={drawerId} onClose={() => setDrawerId(null)}
          onEdit={(d) => { setDrawerId(null); setComposer({ draft: { invoice: d.invoice, lines: d.lines || [], client: d.client } }); }}
          onNewForClient={(c) => { setDrawerId(null); setComposer({ lockedClient: c }); }} />
      )}
      {ct && (
        <ConfirmDialog title={ct.title} confirmLabel={busy ? 'Working…' : ct.label} danger={ct.danger} busy={busy} onCancel={() => setConfirm(null)} onConfirm={doConfirmed} testid={`confirm-${confirm.action}`}>{ct.body}</ConfirmDialog>
      )}
    </div>
  );
}
