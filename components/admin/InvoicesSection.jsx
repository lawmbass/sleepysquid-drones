import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import ClientInvoices, { InvoiceRow, LINE_LABEL, ModeBadge } from './ClientInvoices';

const STATUSES = ['all', 'draft', 'open', 'overdue', 'paid', 'void'];
const LINES = ['all', 'drones', 'ai', 'web'];
const btn = 'px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50';

function ClientPicker({ onPick, onCancel }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '20', ...(q.trim() ? { search: q.trim() } : {}) });
      const res = await fetch(`/api/admin/users?${params}`);
      const body = await res.json().catch(() => ({}));
      setUsers((body?.data?.users || []).filter((u) => !u.isPendingInvitation && (u.id || u._id)));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 p-4 space-y-3" data-testid="invoice-client-picker">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Who is this invoice for?</h4>
        <span className="flex-1" />
        <button type="button" className={`${btn} border`} onClick={onCancel}>Cancel</button>
      </div>
      <input autoFocus className="w-full rounded border px-3 py-2 text-sm dark:bg-gray-800" placeholder="Search clients by name, email or company" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && <p className="text-sm text-gray-500">Searching…</p>}
      <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-72 overflow-auto">
        {users.map((u) => (
          <li key={u.id || u._id}>
            <button type="button" className="w-full text-left px-2 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => onPick(u.id || u._id)}>
              <span className="font-medium">{u.name || u.email}</span> <span className="text-gray-500">{u.email}{u.company ? ` · ${u.company}` : ''}</span>
            </button>
          </li>
        ))}
        {!loading && users.length === 0 && <li className="text-sm text-gray-500 py-2">No matching clients.</li>}
      </ul>
    </div>
  );
}

export default function InvoicesSection() {
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [line, setLine] = useState('all');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const clientId = typeof router.query.client === 'string' ? router.query.client : '';

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/invoicing/invoices?${new URLSearchParams({ status, line })}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.message || 'Could not load invoices'); return; }
    setError(''); setData(body.data);
  }, [status, line]);
  useEffect(() => { load(); }, [load]);

  const openClient = (id) => { setPicking(false); router.push({ pathname: '/dashboard', query: { section: 'invoices', client: id } }, undefined, { shallow: true }); };
  const closeClient = () => { router.push({ pathname: '/dashboard', query: { section: 'invoices' } }, undefined, { shallow: true }); load(); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices<ModeBadge mode={data?.mode} /></h2>
        <span className="flex-1" />
        {!clientId && !picking && <button type="button" className={`${btn} bg-blue-600 text-white px-4 py-2 text-base`} onClick={() => setPicking(true)} data-testid="invoices-new">New invoice</button>}
      </div>

      {picking && <ClientPicker onPick={openClient} onCancel={() => setPicking(false)} />}

      {clientId && (
        <div className="rounded border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex"><span className="flex-1" /><button type="button" className={`${btn} border`} onClick={closeClient}>Back to all invoices</button></div>
          <ClientInvoices key={clientId} userId={clientId} startCreating />
        </div>
      )}

      {!clientId && (
        <>
          <div className="flex flex-wrap gap-4 items-center">
            <label className="text-sm">Status{' '}
              <select className="ml-1 rounded border px-2 py-1 dark:bg-gray-800" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="invoices-status-filter">
                {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
              </select>
            </label>
            <label className="text-sm">Service{' '}
              <select className="ml-1 rounded border px-2 py-1 dark:bg-gray-800" value={line} onChange={(e) => setLine(e.target.value)} data-testid="invoices-line-filter">
                {LINES.map((l) => <option key={l} value={l}>{l === 'all' ? 'All services' : LINE_LABEL[l]}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {data?.migrated === false && <p className="text-sm text-amber-700">{data.notice}</p>}
          {!data && !error && <p className="text-sm text-gray-500">Loading invoices…</p>}
          {data && data.invoices.length === 0 && <p className="text-sm text-gray-500">No invoices match these filters.</p>}
          {data && data.invoices.length > 0 && (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded border border-gray-200 dark:border-gray-700">
              {data.invoices.map((inv) => (
                <li key={inv.id} className="px-3">
                  <p className="pt-2 text-sm font-medium text-gray-900 dark:text-white">
                    {inv.client?.name || inv.client?.email || 'Unknown client'}
                    {inv.client?.email && <span className="text-gray-500 font-normal"> · {inv.client.email}</span>}
                    {(inv.businessLines || []).map((l) => <span key={l} className="ml-2 text-xs rounded bg-gray-100 dark:bg-gray-700 px-1.5">{LINE_LABEL[l] || l}</span>)}
                  </p>
                  <ul><InvoiceRow inv={inv} client={inv.client || {}} onChanged={load} /></ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
