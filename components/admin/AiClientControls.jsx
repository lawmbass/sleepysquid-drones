// AI client controls inside User Management (moved from the old "Manage AI clients" page).
// The API (/api/user/ai-portal-admin) re-checks admin server-side; type-the-name confirms and
// "permanent delete only after delete" are enforced there too.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export async function aiCall(body) {
  const r = await fetch('/api/user/ai-portal-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "That didn't work. Please try again.");
  return j;
}

// Loads active AI clients, plus deleted ones when showDeleted is on.
export function useAiClients(enabled, showDeleted) {
  const [s, setS] = useState({ clients: [], deleted: [], defaultRate: 19, error: '' });
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const get = async (q) => { const r = await fetch(`/api/user/ai-portal-admin${q}`); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
      const [a, d] = await Promise.all([get(''), showDeleted ? get('?deleted=1') : Promise.resolve({ clients: [] })]);
      setS({ clients: a.clients || [], deleted: d.clients || [], defaultRate: a.defaultRate ?? 19, error: '' });
    } catch { setS((p) => ({ ...p, error: "Couldn't load AI clients. Please refresh." })); }
  }, [enabled, showDeleted]);
  useEffect(() => { load(); }, [load]);
  return [s, load];
}

const input = 'block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm';
const btn = 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border';

export function AiTag({ c }) {
  return (
    <span data-testid="ai-tag" className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.deleted_at ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
      {c.deleted_at ? 'AI client (deleted)' : 'AI client'} · ${Number(c.hourly_rate).toFixed(2)}/hr{c.is_example ? ' · example' : ''}
    </span>
  );
}

function Confirm({ c, kind, onClose, onDone }) {
  const [typed, setTyped] = useState(''), [err, setErr] = useState(null), [busy, setBusy] = useState(false), purge = kind === 'purge';
  async function go(e) { e.preventDefault(); setBusy(true); setErr(null); try { await aiCall({ action: kind, id: c.id, confirm_name: typed }); onDone(); } catch (x) { setErr(x.message); setBusy(false); } }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby={`dlg-${c.id}`}>
      <form onSubmit={go} className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl whitespace-normal" data-testid="ai-confirm">
        <h3 id={`dlg-${c.id}`} className="text-lg font-semibold text-gray-900 dark:text-white">{purge ? `Permanently delete ${c.name}?` : `Delete AI client ${c.name}?`}</h3>
        {purge
          ? <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert"><b>This can&apos;t be undone.</b> All of this client&apos;s reports, API keys, automations and login emails are erased for good, along with the client itself. Their user account (if any) is not touched.</p>
          : <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Their AI login stops working and their API keys are revoked so their bots get 401. Reports are kept. Their user account (if any) is not touched. You can restore the client later from &quot;Show deleted AI clients&quot;.</p>}
        <label className="mt-4 block text-sm text-gray-700 dark:text-gray-300">Type <b>{c.name}</b> to confirm
          <input className={`${input} mt-1`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus data-testid="confirm-name" /></label>
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 text-sm rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50" disabled={busy || typed.trim() !== c.name} data-testid="confirm-go">{busy ? 'Deleting…' : purge ? 'Delete permanently' : 'Delete AI client'}</button>
        </div>
      </form>
    </div>
  );
}

// Tag + actions for one AI client, shown inside its user row (or its own row when there is no account).
export function AiClientControls({ c, onChanged }) {
  const [edit, setEdit] = useState(false), [name, setName] = useState(c.name), [email, setEmail] = useState(c.emails[0] || ''), [rate, setRate] = useState(String(c.hourly_rate ?? ''));
  const [err, setErr] = useState(null), [busy, setBusy] = useState(false), [dlg, setDlg] = useState(null);
  async function act(body) { setBusy(true); setErr(null); try { await aiCall(body); setEdit(false); onChanged(); } catch (x) { setErr(x.message); } setBusy(false); }
  return (
    <div className="mt-2 whitespace-normal" data-testid="ai-controls">
      <div className="flex flex-wrap items-center gap-2">
        <AiTag c={c} />
        {c.deleted_at ? (<>
          <button className={`${btn} border-gray-300 text-gray-700 dark:text-gray-200`} onClick={() => act({ action: 'restore', id: c.id })} disabled={busy}>Restore AI client</button>
          <button className={`${btn} border-red-300 text-red-700 dark:text-red-300`} onClick={() => setDlg('purge')} disabled={busy}>Delete permanently</button>
        </>) : (<>
          <Link className={`${btn} border-blue-300 text-blue-700 dark:text-blue-300`} href={`/dashboard?section=ai&client=${encodeURIComponent(c.id)}`}>View report</Link>
          <button className={`${btn} border-gray-300 text-gray-700 dark:text-gray-200`} onClick={() => setEdit(!edit)} data-testid="ai-edit">Edit AI client</button>
          <button className={`${btn} border-red-300 text-red-700 dark:text-red-300`} onClick={() => setDlg('delete')} data-testid="ai-delete">Delete AI client</button>
        </>)}
      </div>
      {edit && (
        <form className="mt-3 grid gap-3 w-full lg:min-w-[34rem] lg:grid-cols-[2fr_2fr_1fr]" onSubmit={(e) => { e.preventDefault(); act({ action: 'update', id: c.id, name, email, hourly_rate: rate }); }} data-testid="ai-edit-form">
          <label className="text-xs text-gray-600 dark:text-gray-300">Business name<input className={input} value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">AI login email<input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">Hourly rate ($/hr)<input className={input} type="number" min="1" max="1000" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
          <div className="lg:col-span-3 flex gap-2">
            <button type="button" className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200" onClick={() => setEdit(false)}>Cancel</button>
            <button className="px-3 py-1.5 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {dlg && <Confirm c={c} kind={dlg} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onChanged(); }} />}
    </div>
  );
}

// "Make them an AI client" fields for the Add user / Edit user modal.
export function AiClientFields({ value, onChange, defaultRate = 19 }) {
  return (
    <div className="mt-4 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-4" data-testid="ai-fields">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
        <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} data-testid="ai-toggle" />
        Make them an AI client
      </label>
      {value.on && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-600 dark:text-gray-300">Business name *<input className={input} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} required placeholder="Business name" data-testid="ai-name" /></label>
          <label className="text-xs text-gray-600 dark:text-gray-300">Hourly rate ($/hr)<input className={input} type="number" min="1" max="1000" step="0.01" value={value.rate} onChange={(e) => onChange({ ...value, rate: e.target.value })} placeholder={String(defaultRate)} data-testid="ai-rate" /></label>
          <p className="sm:col-span-2 text-xs text-gray-600 dark:text-gray-400">They sign in at sleepysquid.com/login with the email above (one-time link or Google) and see their AI report.</p>
        </div>
      )}
    </div>
  );
}
