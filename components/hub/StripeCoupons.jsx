import { useCallback, useEffect, useState } from 'react';
import { SERVICE_LINES } from '@/libs/serviceLines';
import ServiceChip, { ServiceFilter } from './ServiceChip';

const EMPTY_FORM = { name: '', percentOff: '', amountOff: '', duration: 'once', durationInMonths: '', maxRedemptions: '', code: '', services: [] };

function discountLabel(c) {
  if (c.percentOff) return `${c.percentOff}% off`;
  if (c.amountOff) return `${(c.amountOff / 100).toLocaleString('en-US', { style: 'currency', currency: (c.currency || 'usd').toUpperCase() })} off`;
  return '—';
}

function durationLabel(c) {
  if (c.duration === 'repeating') return `for ${c.durationInMonths} months`;
  return c.duration;
}

function CouponForm({ initial, editing, onCancel, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setForm((f) => ({ ...f, services: f.services.includes(id) ? f.services.filter((s) => s !== id) : [...f.services, id] }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.services.length) { setError('Choose at least one service.'); return; }
    setSaving(true); setError('');
    try {
      const response = await fetch(editing ? `/api/admin/stripe-coupons/${editing}` : '/api/admin/stripe-coupons', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editing ? { name: form.name, services: form.services } : form),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Could not save the coupon');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = 'mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white';
  return (
    <form onSubmit={submit} className="space-y-4 border-t border-gray-200 dark:border-gray-700 px-6 py-5">
      <fieldset>
        <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Services this coupon applies to <span className="text-red-500">*</span></legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {SERVICE_LINES.map((s) => (
            <label key={s.id} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={form.services.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">Stripe will only accept it on those services&apos; products.</p>
        {editing && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Stripe cannot change which products a coupon covers. Changing services creates a replacement coupon, moves its promotion codes to it and deletes the old coupon. Customers already using it keep their discount.</p>}
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="text-sm text-gray-700 dark:text-gray-300">Name<input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} required /></label>
        {!editing && <>
          <label className="text-sm text-gray-700 dark:text-gray-300">Percent off<input className={input} type="number" min="1" max="100" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value, amountOff: '' })} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-300">or amount off (USD)<input className={input} type="number" min="1" value={form.amountOff} onChange={(e) => setForm({ ...form, amountOff: e.target.value, percentOff: '' })} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Duration
            <select className={input} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
              <option value="once">Once</option><option value="repeating">Repeating</option><option value="forever">Forever</option>
            </select>
          </label>
          {form.duration === 'repeating' && <label className="text-sm text-gray-700 dark:text-gray-300">Months<input className={input} type="number" min="1" value={form.durationInMonths} onChange={(e) => setForm({ ...form, durationInMonths: e.target.value })} /></label>}
          <label className="text-sm text-gray-700 dark:text-gray-300">Max redemptions<input className={input} type="number" min="1" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} /></label>
          <label className="text-sm text-gray-700 dark:text-gray-300">Promotion code<input className={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Optional" /></label>
        </>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}</button>
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-gray-600 dark:text-gray-300">Cancel</button>
      </div>
    </form>
  );
}

export default function StripeCoupons() {
  const [state, setState] = useState({ loading: true, error: '', configured: false, writesAllowed: false, coupons: [] });
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(null); // null | { editing, initial }

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const response = await fetch('/api/admin/stripe-coupons', { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Could not load Stripe coupons');
      setState({ loading: false, error: '', ...body.data });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = state.coupons.filter((c) => !filter || c.services.includes(filter));

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Stripe coupons and promotion codes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Used at checkout for any service.</p>
        </div>
        <button
          type="button"
          disabled={!state.writesAllowed}
          title={state.writesAllowed ? '' : 'Coupon changes are only enabled with a Stripe test-mode key'}
          onClick={() => setForm({ editing: null, initial: EMPTY_FORM })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          New coupon
        </button>
      </div>
      {!state.writesAllowed && state.configured && (
        <p className="px-6 pt-3 text-xs text-gray-500">Read-only: this deployment uses a live Stripe key, so coupons can&apos;t be created or edited here.</p>
      )}
      {form && <CouponForm key={form.editing || 'new'} {...form} onCancel={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <ServiceFilter value={filter} onChange={setFilter} label="Filter coupons by service" />
      </div>
      {state.loading ? (
        <p className="px-6 py-6 text-sm text-gray-500">Loading coupons…</p>
      ) : state.error ? (
        <p className="px-6 py-6 text-sm text-red-600">{state.error}</p>
      ) : !state.configured ? (
        <p className="px-6 py-6 text-sm text-gray-400 italic">Stripe is not connected on this deployment.</p>
      ) : visible.length === 0 ? (
        <p className="px-6 py-6 text-sm text-gray-400 italic">No coupons{filter ? ' for this service' : ''}.</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {visible.map((c) => (
            <li key={c.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-medium text-gray-900 dark:text-white">{c.name} <span className="text-xs font-mono text-gray-400">{c.id}</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {discountLabel(c)} · {durationLabel(c)} · {c.timesRedeemed}{c.maxRedemptions ? ` of ${c.maxRedemptions}` : ''} redeemed{c.valid ? '' : ' · expired'}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.services.length ? c.services.map((s) => <ServiceChip key={s} id={s} />) : <span className="text-xs text-gray-400">No service tag</span>}
                    {!c.enforcedInStripe && <span className="text-xs text-amber-700 dark:text-amber-300">Not product-restricted in Stripe: works on every service</span>}
                  </div>
                  {c.codes.length > 0 && (
                    <p className="text-xs text-gray-500">Codes: {c.codes.map((code) => `${code.code}${code.active ? '' : ' (inactive)'}`).join(', ')}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!state.writesAllowed}
                  onClick={() => setForm({ editing: c.id, initial: { ...EMPTY_FORM, name: c.name, services: c.services } })}
                  className="text-sm text-blue-600 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
