import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CLIENT_FILTERS, CLIENT_FILTER_LABEL, SERVICES, SERVICE_LABEL, canInvite, canRemoveLogin, filterClients, hasLogin, inviteConfirmText, portalStatus, removeLoginText, rowActionsFor, validateClient } from '@/libs/clients/core.mjs';
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

/** Portal login for one client: status, who can sign in, and Invite / Remove login. */
export function LoginPanel({ c, onInvite, onRemoveLogin }) {
  const who = [c.userId && 'client portal account', (c.aiLogins || []).length && `AI report (${c.aiLogins.join(', ')})`].filter(Boolean).join(' · ');
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2" data-testid="login-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Portal login</span>
        <PortalPill c={c} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {hasLogin(c) ? `Can sign in: ${who}.` : c.invitedAt ? `Invite sent to ${c.email}. They get access when they sign in with that email.` : c.email ? 'No login. Invite them to give portal access.' : 'Add an email to invite them.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {canInvite(c) && <button type="button" className={`${btn} border border-blue-600 text-blue-700 dark:text-blue-300`} onClick={() => onInvite?.(c)} data-testid="form-invite">{c.invitedAt ? 'Resend invite' : 'Invite'}</button>}
        {canRemoveLogin(c) && <button type="button" className={`${btn} border border-red-300 text-red-700`} onClick={() => onRemoveLogin?.(c)} data-testid="form-remove-login">Remove login</button>}
      </div>
    </div>
  );
}

export function ClientForm({ client, fromLogin = null, onSaved, onCancel, onArchive, onRemoveLogin, onInvite, onUnarchive, onPurgeAi }) {
  const [f, setF] = useState(() => ({
    businessName: client?.businessName || fromLogin?.company || '', contactName: client?.contactName || fromLogin?.name || '', email: client?.email || fromLogin?.email || '', phone: client?.phone || fromLogin?.phone || '',
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
    const r = await api(client ? `/api/admin/clients/${client.id}` : '/api/admin/clients', { method: client ? 'PATCH' : 'POST', body: JSON.stringify(fromLogin ? { ...f, linkUserId: fromLogin.id } : f) });
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
        {!client && !fromLogin && <button type="button" className={`${btn} border border-blue-600 text-blue-700 dark:text-blue-300`} disabled={busy || !emailSet} title={emailSet ? '' : 'Add an email to invite'} onClick={() => save(true)} data-testid="save-invite">Save and invite to portal</button>}
        <button type="button" className={`${btn} text-gray-600 dark:text-gray-300`} onClick={onCancel}>Cancel</button>
      </div>
      {client && <LoginPanel c={client} onInvite={onInvite} onRemoveLogin={onRemoveLogin} />}
      {client && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
          {!client.archivedAt && <button type="button" className={`${btn} border border-red-300 text-red-700`} onClick={() => onArchive?.(client)} data-testid="form-archive">Archive</button>}
          {client.archivedAt && <button type="button" className={`${btn} border border-gray-300 text-gray-700 dark:text-gray-200`} onClick={() => onUnarchive?.(client)} data-testid="form-unarchive">Unarchive</button>}
          {client.archivedAt && client.portalClientId && <button type="button" className={`${btn} border border-red-300 text-red-700`} onClick={() => onPurgeAi?.(client)} data-testid="form-purge-ai">Delete AI data permanently</button>}
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

function ClientDetail({ c, onClose, onEdit, onRemoveLogin }) {
  return (
    <Modal title={c.businessName} onClose={onClose}>
      <dl className="grid grid-cols-3 gap-y-2 text-sm" data-testid="client-detail">
        <dt className="text-gray-500">Contact</dt><dd className="col-span-2">{c.contactName || '—'}</dd>
        <dt className="text-gray-500">Email</dt><dd className="col-span-2 break-all">{c.email || '—'}</dd>
        <dt className="text-gray-500">Phone</dt><dd className="col-span-2">{c.phone || '—'}</dd>
        <dt className="text-gray-500">Services</dt><dd className="col-span-2"><Services c={c} /></dd>
        <dt className="text-gray-500">Portal</dt><dd className="col-span-2"><PortalPill c={c} />{(c.aiLogins || []).length > 0 && <span className="ml-2 text-xs text-gray-500 break-all">AI login: {c.aiLogins.join(', ')}</span>}</dd>
        <dt className="text-gray-500">Owed</dt><dd className="col-span-2">{money(c.owedCents)}</dd>
        <dt className="text-gray-500">Last invoice</dt><dd className="col-span-2">{c.lastInvoiceAt ? fmtDate(c.lastInvoiceAt) : '—'}</dd>
        {c.notes && <><dt className="text-gray-500">Notes</dt><dd className="col-span-2 whitespace-pre-wrap">{c.notes}</dd></>}
      </dl>
      <div className="flex flex-wrap gap-2 mt-4">
        {c.email && !c.archivedAt && <Link className={`${btn} bg-blue-600 text-white`} href={`/dashboard?section=invoices&client=${encodeURIComponent(c.ref)}`}>New invoice</Link>}
        <button className={`${btn} border border-gray-300`} onClick={() => onEdit(c)}>Edit</button>
        {canRemoveLogin(c) && <button className={`${btn} border border-red-300 text-red-700`} onClick={() => onRemoveLogin(c)} data-testid="detail-remove-login">Remove login</button>}
      </div>
    </Modal>
  );
}

const CONFIRM = {
  invite: { title: () => 'Send portal invite', label: 'Send invite', body: (c) => inviteConfirmText(c.email) },
  archive: { title: (c) => `Archive ${c.businessName}?`, label: 'Archive', danger: true,
    body: (c) => `Hidden from the list by default. Their invoices are kept.${c.portalClientId ? ' Their AI login stops and their API keys are revoked (bots get 401); AI report data is kept. Unarchive restores the AI client.' : ''}` },
  unarchive: { title: (c) => `Unarchive ${c.businessName}?`, label: 'Unarchive', body: (c) => `Back in the client list.${c.portalClientId ? ' Their AI client is restored; revoked API keys stay revoked.' : ''}` },
  'remove-login': { title: (c) => `Remove ${c.businessName}'s login?`, label: 'Remove login', danger: true, body: (c) => removeLoginText(c) },
  'purge-ai': { title: (c) => `Permanently delete ${c.businessName}'s AI data?`, label: 'Delete permanently', danger: true, typed: true,
    body: () => "This can't be undone. All of their AI reports, API keys, automations and AI logins are erased for good. The client record and invoices stay." },
  'remove-user': { title: (c) => `Remove ${c.email}'s login?`, label: 'Remove login', danger: true, body: () => "They won't be able to use the dashboard. Their account and any invoices stay; you can link them to a client later." },
  'cancel-invite': { title: (c) => `Cancel the invite to ${c.email}?`, label: 'Cancel invite', danger: true, body: () => 'The invite link stops working. No email is sent.' },
};

export default function ClientsSection({ initialClients = null, initialLogins = [] }) {
  const [clients, setClients] = useState(initialClients || []);
  const [state, setState] = useState(initialClients ? { loading: false, migrated: true } : { loading: true });
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);   // null | 'new' | client
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);   // { kind: 'archive'|'unarchive'|'invite'|'remove-login'|'purge-ai'|'remove-user'|'cancel-invite', c }
  const [typed, setTyped] = useState('');
  const [logins, setLogins] = useState(initialLogins);       // client accounts / invitations with no client record
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    const r = await api('/api/admin/clients');
    if (!r.ok) { setState({ loading: false, error: r.body.message || 'Could not load clients' }); return; }
    setClients(r.body.data.clients); setLogins(r.body.data.logins || []); setState({ loading: false, migrated: r.body.data.migrated, notice: r.body.data.notice });
  }, []);
  useEffect(() => { if (!initialClients) load(); }, [load, initialClients]);

  const visible = useMemo(() => filterClients(clients, { filter, q, showArchived }), [clients, filter, q, showArchived]);
  const counts = useMemo(() => Object.fromEntries(CLIENT_FILTERS.map((k) => [k, filterClients(clients, { filter: k, q, showArchived }).length])), [clients, q, showArchived]);
  const archivedCount = clients.filter((c) => c.archivedAt).length;

  const upsert = (c) => setClients((list) => (list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? { ...x, ...c } : x)) : [...list, c]));
  const runConfirm = async () => {
    const { kind, c } = confirm;
    setBusy(true);
    const r = kind === 'invite' ? await api(`/api/admin/clients/${c.id}/invite`, { method: 'POST', body: JSON.stringify({ confirmEmail: c.email }) })
      : kind === 'remove-user' ? await api('/api/admin/clients/logins', { method: 'POST', body: JSON.stringify({ action: 'remove', userId: c.id }) })
      : kind === 'cancel-invite' ? await api(`/api/admin/invitations/${c.id}`, { method: 'DELETE' })
      : await api(`/api/admin/clients/${c.id}`, { method: 'POST', body: JSON.stringify({ action: kind, confirmName: typed }) });
    setBusy(false); setConfirm(null); setTyped('');
    if (!r.ok) { setToast(r.body.message || 'Something went wrong'); return; }
    if (kind === 'remove-user' || kind === 'cancel-invite') { setToast(kind === 'remove-user' ? `Login removed for ${c.email}` : 'Invite cancelled'); load(); return; }
    const saved = r.body.data.client;
    upsert(saved);
    setToast({ invite: `Invite sent to ${c.email}`, archive: `${c.businessName} archived`, unarchive: `${c.businessName} unarchived`, 'remove-login': `Login removed for ${c.businessName}. The client is kept.`, 'purge-ai': `${c.businessName}'s AI data deleted` }[kind]);
    if (editing && editing !== 'new') setEditing(kind === 'archive' ? null : saved);
    if (viewing) setViewing(saved);
  };
  const linkLogin = async (l) => {
    setBusy(true);
    const r = await api(`/api/admin/clients/${l.matchClientId}`, { method: 'POST', body: JSON.stringify({ action: 'link-user', userId: l.id }) });
    setBusy(false);
    if (!r.ok) { setToast(r.body.message || 'Could not link'); return; }
    upsert(r.body.data.client); setLogins((xs) => xs.filter((x) => x.id !== l.id)); setToast(`${l.email} linked to ${r.body.data.client.businessName}`);
  };
  const del = confirm && CONFIRM[confirm.kind];

  const actions = (c) => rowActionsFor(c).map((a) => {
    const cls = 'text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 whitespace-nowrap';
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
    if (a === 'invoice') return <Link key={a} className={cls} href={`/dashboard?section=invoices&client=${encodeURIComponent(c.ref)}`} onClick={(e) => e.stopPropagation()} data-testid="row-new-invoice">New invoice</Link>;
    if (a === 'invite' || a === 'resend') return <button key={a} className={cls} onClick={stop(() => setConfirm({ kind: 'invite', c }))} data-testid={`row-${a}`}>{a === 'invite' ? 'Invite' : 'Resend'}</button>;
    if (a === 'report') return <Link key={a} className={cls} href={`/dashboard?section=ai&client=${encodeURIComponent(c.portalClientId)}`} onClick={(e) => e.stopPropagation()} data-testid="row-report">AI report</Link>;
    if (a === 'remove-login') return <button key={a} className="text-sm text-red-600 hover:text-red-800 whitespace-nowrap" onClick={stop(() => setConfirm({ kind: 'remove-login', c }))} data-testid="row-remove-login">Remove login</button>;
    if (a === 'edit') return <button key={a} className={cls} onClick={stop(() => setEditing(c))}>Edit</button>;
    return <button key={a} className="text-sm text-red-600 hover:text-red-800 whitespace-nowrap" onClick={stop(() => setConfirm({ kind: 'archive', c }))}>Archive</button>;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1><p className="text-sm text-gray-500 dark:text-gray-400">Drones, AI and web clients and their portal logins. Staff are on the Team page.</p></div>
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

      {logins.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" data-testid="unlinked-logins">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Logins without a client record ({logins.length})</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Client accounts and invites that aren&apos;t attached to a client yet. Link or create a client to invoice them.</p>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {logins.map((l) => {
              const match = l.matchClientId && clients.find((c) => c.id === l.matchClientId);
              return (
                <li key={`${l.kind}-${l.id}`} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2" data-testid="unlinked-login">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white break-all">{l.name || l.email}</div>
                    <div className="text-xs text-gray-500 break-all">{[l.name && l.email, l.company, l.kind === 'invitation' ? 'Invite pending' : l.hasAccess ? 'Has access' : 'No access'].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {l.kind === 'user' && match && <button className="text-sm text-blue-600 hover:text-blue-900 whitespace-nowrap" disabled={busy} onClick={() => linkLogin(l)}>Link to {match.businessName}</button>}
                    {l.kind === 'user' && !match && <button className="text-sm text-blue-600 hover:text-blue-900 whitespace-nowrap" onClick={() => setEditing({ fromLogin: l })}>Create client</button>}
                    {l.kind === 'user' && l.hasAccess && <button className="text-sm text-red-600 hover:text-red-800 whitespace-nowrap" onClick={() => setConfirm({ kind: 'remove-user', c: l })}>Remove login</button>}
                    {l.kind === 'invitation' && <button className="text-sm text-red-600 hover:text-red-800 whitespace-nowrap" onClick={() => setConfirm({ kind: 'cancel-invite', c: l })}>Cancel invite</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {viewing && <ClientDetail c={viewing} onClose={() => setViewing(null)} onEdit={(c) => { setViewing(null); setEditing(c); }} onRemoveLogin={(c) => setConfirm({ kind: 'remove-login', c })} />}
      {editing && (
        <Modal title={editing === 'new' || editing.fromLogin ? 'New client' : `Edit ${editing.businessName}`} onClose={() => setEditing(null)}>
          <ClientForm client={editing === 'new' || editing.fromLogin ? null : editing} fromLogin={editing.fromLogin || null} onCancel={() => setEditing(null)}
            onSaved={(c) => { upsert(c); if (editing.fromLogin) setLogins((xs) => xs.filter((x) => x.id !== editing.fromLogin.id)); setEditing(null); setToast(`${c.businessName} saved`); }}
            onArchive={(c) => setConfirm({ kind: 'archive', c })} onUnarchive={(c) => setConfirm({ kind: 'unarchive', c })}
            onRemoveLogin={(c) => setConfirm({ kind: 'remove-login', c })} onInvite={(c) => setConfirm({ kind: 'invite', c })} onPurgeAi={(c) => setConfirm({ kind: 'purge-ai', c })} />
        </Modal>
      )}
      {confirm && del && (
        <ConfirmDialog busy={busy} danger={Boolean(del.danger)} onConfirm={runConfirm} onCancel={() => { setConfirm(null); setTyped(''); }} testid={`confirm-${confirm.kind}`}
          title={del.title(confirm.c)} confirmLabel={del.label} confirmDisabled={del.typed && typed.trim() !== confirm.c.businessName}>
          <p>{del.body(confirm.c)}</p>
          {del.typed && <label className="mt-3 block">Type <b>{confirm.c.businessName}</b> to confirm<input className={`${input} mt-1`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></label>}
        </ConfirmDialog>
      )}
    </div>
  );
}
