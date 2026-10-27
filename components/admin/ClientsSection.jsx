import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CLIENT_FILTERS, CLIENT_FILTER_LABEL, SERVICES, SERVICE_LABEL, filterClients, inviteConfirmText, portalStatus, rowActionsFor, validateClient } from '@/libs/clients/core.mjs';
import { api, btn, ConfirmDialog, fmtDate, input, money } from './invoicing/shared';

const PORTAL_CLASS = {
  login: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  invited: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  none: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};
const SERVICE_CLASS = 'px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200';

function PortalPill({ c }) {
  const p = portalStatus(c);
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${PORTAL_CLASS[p.key]}`} data-testid="portal-status">{p.label}</span>;
}
const Services = ({ c }) => (
  <div className="flex flex-wrap gap-1">{(c.services || []).map((s) => <span key={s} className={SERVICE_CLASS}>{SERVICE_LABEL[s]}{s === 'ai' && c.hourlyRate != null ? ` · $${c.hourlyRate}/hr` : ''}</span>)}</div>
);

export function ClientForm({ client, onSaved, onCancel, onArchive, onRevoke }) {
  const [f, setF] = useState(() => ({
    businessName: client?.businessName || '', contactName: client?.contactName || '', email: client?.email || '', phone: client?.phone || '',
    services: client?.services || [], hourlyRate: client?.hourlyRate ?? '', notes: client?.notes || '',
  }));
  const [notesOpen, setNotesOpen] = useState(Boolean(client?.notes));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmInvite, setConfirmInvite] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (svc) => setF((s) => ({ ...s, services: s.services.includes(svc) ? s.services.filter((x) => x !== svc) : [...s.services, svc] }));
  const aiOn = f.services.includes('ai');
  const emailSet = Boolean(f.email.trim());

  const save = async (invite) => {
    const v = validateClient(f);
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors({}); setBusy(true);
    const r = await api(client ? `/api/admin/clients/${client.id}` : '/api/admin/clients', { method: client ? 'PATCH' : 'POST', body: JSON.stringify(f) });
    setBusy(false);
    if (!r.ok) { setErrors(r.body.fields || { form: r.body.message || 'Could not save' }); return; }
    const saved = r.body.data.client;
    if (invite) setConfirmInvite(saved); else onSaved?.(saved);
  };
  const sendInvite = async () => {
    setBusy(true);
    const r = await api(`/api/admin/clients/${confirmInvite.id}/invite`, { method: 'POST', body: JSON.stringify({ confirmEmail: confirmInvite.email }) });
    setBusy(false);
    if (!r.ok) { setErrors({ form: r.body.message || 'Could not send the invite' }); setConfirmInvite(null); return; }
    onSaved?.(r.body.data.client);
  };

  const label = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1';
  const err = (k) => errors[k] && <p className="mt-1 text-xs text-red-600" role="alert">{errors[k]}</p>;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(false); }} data-testid="client-form">
      <div><label className={label} htmlFor="cf-business">Business name</label><input id="cf-business" className={input} value={f.businessName} onChange={set('businessName')} autoFocus />{err('businessName')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={label} htmlFor="cf-contact">Contact</label><input id="cf-contact" className={input} value={f.contactName} onChange={set('contactName')} placeholder="Optional" /></div>
        <div><label className={label} htmlFor="cf-phone">Phone</label><input id="cf-phone" className={input} value={f.phone} onChange={set('phone')} placeholder="Optional" inputMode="tel" /></div>
      </div>
      <div><label className={label} htmlFor="cf-email">Email</label><input id="cf-email" className={input} value={f.email} onChange={set('email')} type="email" placeholder="Needed to invite or invoice" />{err('email')}</div>
      <div>
        <span className={label}>Services</span>
        <div className="flex flex-wrap items-center gap-2">
          {SERVICES.map((s) => (
            <button type="button" key={s} onClick={() => toggle(s)} aria-pressed={f.services.includes(s)} data-testid={`svc-${s}`}
              className={`px-3 py-1.5 rounded-full text-sm border ${f.services.includes(s) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>{SERVICE_LABEL[s]}</button>
          ))}
          {aiOn && (
            <label className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200" data-testid="rate-field">
              <span className="sr-only">Hourly rate</span>$
              <input className={`${input} w-24`} value={f.hourlyRate} onChange={set('hourlyRate')} inputMode="decimal" placeholder="Rate" aria-label="Hourly rate" />/hr
            </label>
          )}
        </div>
        {err('hourlyRate')}
      </div>
      <div>
        <button type="button" className="text-sm text-blue-600 dark:text-blue-400" onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen}>{notesOpen ? '▾' : '▸'} Notes</button>
        {notesOpen && <textarea className={`${input} mt-2`} rows={3} value={f.notes} onChange={set('notes')} aria-label="Notes" />}
      </div>
      {errors.form && <p className="text-sm text-red-600" role="alert">{errors.form}</p>}
      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className={`${btn} bg-blue-600 text-white`} disabled={busy}>Save</button>
        {!client?.userId && <button type="button" className={`${btn} border border-blue-600 text-blue-700 dark:text-blue-300`} disabled={busy || !emailSet} title={emailSet ? '' : 'Add an email to invite'} onClick={() => save(true)} data-testid="save-invite">Save and invite to portal</button>}
        <button type="button" className={`${btn} text-gray-600 dark:text-gray-300`} onClick={onCancel}>Cancel</button>
      </div>
      {client && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
          {client.userId && <button type="button" className={`${btn} border border-gray-300 text-gray-700 dark:text-gray-200`} onClick={() => onRevoke?.(client)}>Revoke portal access</button>}
          {!client.archivedAt && <button type="button" className={`${btn} border border-red-300 text-red-700`} onClick={() => onArchive?.(client)} data-testid="form-archive">Archive</button>}
        </div>
      )}
      {confirmInvite && (
        <ConfirmDialog title="Send portal invite" confirmLabel="Send invite" busy={busy} onConfirm={sendInvite} onCancel={() => { setConfirmInvite(null); onSaved?.(confirmInvite); }}>
          {inviteConfirmText(confirmInvite.email)}
        </ConfirmDialog>
      )}
    </form>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full sm:max-w-lg max-h-[95vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl p-5">
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2><button className="text-gray-500 text-xl leading-none" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

function ClientDetail({ c, onClose, onEdit }) {
  return (
    <Modal title={c.businessName} onClose={onClose}>
      <dl className="grid grid-cols-3 gap-y-2 text-sm" data-testid="client-detail">
        <dt className="text-gray-500">Contact</dt><dd className="col-span-2">{c.contactName || '—'}</dd>
        <dt className="text-gray-500">Email</dt><dd className="col-span-2 break-all">{c.email || '—'}</dd>
        <dt className="text-gray-500">Phone</dt><dd className="col-span-2">{c.phone || '—'}</dd>
        <dt className="text-gray-500">Services</dt><dd className="col-span-2"><Services c={c} /></dd>
        <dt className="text-gray-500">Portal</dt><dd className="col-span-2"><PortalPill c={c} /></dd>
        <dt className="text-gray-500">Owed</dt><dd className="col-span-2">{money(c.owedCents)}</dd>
        <dt className="text-gray-500">Last invoice</dt><dd className="col-span-2">{c.lastInvoiceAt ? fmtDate(c.lastInvoiceAt) : '—'}</dd>
        {c.notes && <><dt className="text-gray-500">Notes</dt><dd className="col-span-2 whitespace-pre-wrap">{c.notes}</dd></>}
      </dl>
      <div className="flex flex-wrap gap-2 mt-4">
        {c.email && !c.archivedAt && <Link className={`${btn} bg-blue-600 text-white`} href={`/dashboard?section=invoices&client=${encodeURIComponent(c.ref)}`}>New invoice</Link>}
        <button className={`${btn} border border-gray-300`} onClick={() => onEdit(c)}>Edit</button>
      </div>
    </Modal>
  );
}

export default function ClientsSection({ initialClients = null }) {
  const [clients, setClients] = useState(initialClients || []);
  const [state, setState] = useState(initialClients ? { loading: false, migrated: true } : { loading: true });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);   // null | 'new' | client
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);   // { kind: 'archive'|'invite'|'revoke', c }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    const r = await api('/api/admin/clients');
    if (!r.ok) { setState({ loading: false, error: r.body.message || 'Could not load clients' }); return; }
    setClients(r.body.data.clients); setState({ loading: false, migrated: r.body.data.migrated, notice: r.body.data.notice });
  }, []);
  useEffect(() => { if (!initialClients) load(); }, [load, initialClients]);

  const visible = useMemo(() => filterClients(clients, { filter, q, showArchived }), [clients, filter, q, showArchived]);
  const counts = useMemo(() => Object.fromEntries(CLIENT_FILTERS.map((k) => [k, filterClients(clients, { filter: k, q, showArchived }).length])), [clients, q, showArchived]);
  const archivedCount = clients.filter((c) => c.archivedAt).length;

  const upsert = (c) => setClients((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? { ...x, ...c } : x)) : [...list, c]));
  const runConfirm = async () => {
    const { kind, c } = confirm;
    setBusy(true);
    const r = kind === 'invite'
      ? await api(`/api/admin/clients/${c.id}/invite`, { method: 'POST', body: JSON.stringify({ confirmEmail: c.email }) })
      : await api(`/api/admin/clients/${c.id}`, { method: 'POST', body: JSON.stringify({ action: kind }) });
    setBusy(false); setConfirm(null);
    if (!r.ok) { setToast(r.body.message || 'Something went wrong'); return; }
    upsert(r.body.data.client);
    setToast(kind === 'invite' ? `Invite sent to ${c.email}` : kind === 'archive' ? `${c.businessName} archived` : 'Portal access revoked');
    if (editing && editing !== 'new') setEditing(null);
  };

  const actions = (c) => rowActionsFor(c).map((a) => {
    const cls = 'text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 whitespace-nowrap';
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
    if (a === 'invoice') return <Link key={a} className={cls} href={`/dashboard?section=invoices&client=${encodeURIComponent(c.ref)}`} onClick={(e) => e.stopPropagation()} data-testid="row-new-invoice">New invoice</Link>;
    if (a === 'invite' || a === 'resend') return <button key={a} className={cls} onClick={stop(() => setConfirm({ kind: 'invite', c }))} data-testid={`row-${a}`}>{a === 'invite' ? 'Invite' : 'Resend'}</button>;
    if (a === 'report') return <Link key={a} className={cls} href={`/dashboard?section=ai&client=${encodeURIComponent(c.portalClientId)}`} onClick={(e) => e.stopPropagation()} data-testid="row-report">AI report</Link>;
    if (a === 'edit') return <button key={a} className={cls} onClick={stop(() => setEditing(c))}>Edit</button>;
    return <button key={a} className="text-sm text-red-600 hover:text-red-800 whitespace-nowrap" onClick={stop(() => setConfirm({ kind: 'archive', c }))}>Archive</button>;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1><p className="text-sm text-gray-500 dark:text-gray-400">Drones, AI and web clients in one list. Admins aren&apos;t clients.</p></div>
        <button className={`${btn} bg-blue-600 text-white`} onClick={() => setEditing('new')} disabled={!state.migrated} data-testid="new-client">+ New client</button>
      </div>
      {state.notice && <p className="text-sm text-amber-700 bg-amber-50 rounded p-3">{state.notice}</p>}
      {state.error && <p className="text-sm text-red-700 bg-red-50 rounded p-3">{state.error}</p>}
      {toast && <p className="text-sm text-green-800 bg-green-50 rounded p-3" role="status">{toast}</p>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {CLIENT_FILTERS.map((k) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} data-testid={`filter-${k}`}
              className={`px-3 py-1.5 rounded-full text-sm ${filter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>{CLIENT_FILTER_LABEL[k]} <span className="opacity-70">{counts[k]}</span></button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input className={`${input} flex-1 min-w-[12rem]`} placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
          {archivedCount > 0 && <label className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived ({archivedCount})</label>}
        </div>
      </div>

      {state.loading ? <p className="text-sm text-gray-500">Loading clients…</p> : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Desktop table */}
          <table className="hidden md:table w-full text-sm" data-testid="clients-table">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500 dark:text-gray-400 text-left">
              <tr><th className="px-4 py-3">Business / contact</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Services</th><th className="px-4 py-3">Portal</th><th className="px-4 py-3 text-right">Owed</th><th className="px-4 py-3">Last invoice</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visible.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer ${c.archivedAt ? 'opacity-60' : ''}`} onClick={() => setViewing(c)} data-testid="client-row">
                  <td className="px-4 py-3"><div className="font-medium text-gray-900 dark:text-white">{c.businessName}{c.archivedAt && <span className="ml-2 text-xs text-gray-500">Archived</span>}</div><div className="text-gray-500 dark:text-gray-400">{c.contactName || ''}</div></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200 break-all">{c.email || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3"><Services c={c} /></td>
                  <td className="px-4 py-3"><PortalPill c={c} /></td>
                  <td className={`px-4 py-3 text-right tabular-nums ${c.owedCents > 0 ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>{money(c.owedCents)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.lastInvoiceAt ? fmtDate(c.lastInvoiceAt) : '—'}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-x-3 gap-y-1">{actions(c)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700" data-testid="clients-cards">
            {visible.map((c) => (
              <li key={c.id} className="p-4 cursor-pointer" onClick={() => setViewing(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-medium text-gray-900 dark:text-white">{c.businessName}</div><div className="text-sm text-gray-500 break-all">{[c.contactName, c.email].filter(Boolean).join(' · ') || 'No email yet'}</div></div>
                  <PortalPill c={c} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><Services c={c} /><span className="text-sm text-gray-600">{c.owedCents > 0 ? `Owes ${money(c.owedCents)}` : c.lastInvoiceAt ? `Last invoice ${fmtDate(c.lastInvoiceAt)}` : ''}</span></div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{actions(c)}</div>
              </li>
            ))}
          </ul>
          {!visible.length && <p className="p-6 text-sm text-gray-500 text-center">{clients.length ? 'No clients match.' : 'No clients yet.'}</p>}
        </div>
      )}

      {viewing && <ClientDetail c={viewing} onClose={() => setViewing(null)} onEdit={(c) => { setViewing(null); setEditing(c); }} />}
      {editing && (
        <Modal title={editing === 'new' ? 'New client' : `Edit ${editing.businessName}`} onClose={() => setEditing(null)}>
          <ClientForm client={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
            onSaved={(c) => { upsert(c); setEditing(null); setToast(`${c.businessName} saved`); }}
            onArchive={(c) => setConfirm({ kind: 'archive', c })} onRevoke={(c) => setConfirm({ kind: 'revoke', c })} />
        </Modal>
      )}
      {confirm && (
        <ConfirmDialog busy={busy} danger={confirm.kind !== 'invite'} onConfirm={runConfirm} onCancel={() => setConfirm(null)}
          title={confirm.kind === 'invite' ? 'Send portal invite' : confirm.kind === 'archive' ? `Archive ${confirm.c.businessName}?` : 'Revoke portal access?'}
          confirmLabel={confirm.kind === 'invite' ? 'Send invite' : confirm.kind === 'archive' ? 'Archive' : 'Revoke'}>
          {confirm.kind === 'invite' ? inviteConfirmText(confirm.c.email) : confirm.kind === 'archive' ? 'Hidden from the list by default. Their invoices are kept.' : 'They will no longer be able to sign in to the client portal. Their account and invoices stay.'}
        </ConfirmDialog>
      )}
    </div>
  );
}
