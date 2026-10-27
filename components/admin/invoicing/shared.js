import React from 'react';

export const money = (cents, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase() }).format((cents || 0) / 100);
export const LINE_LABEL = { drones: 'Drones', ai: 'AI automation', web: 'Website' };
export const btn = 'px-3 py-2 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed';
export const input = 'block w-full min-w-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-2 text-sm';
export const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-req`);
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export async function api(url, options) {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { message: 'Network error. Check your connection and retry.' } };
  }
}

export function ModeBadge({ mode }) {
  // Live is the normal state: no badge. Only flag test mode.
  if (mode !== 'test') return null;
  return <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold align-middle bg-yellow-300 text-yellow-900" data-testid="mode-badge-test">TEST</span>;
}

export const CHIP_CLASS = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  void: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-200',
  uncollectible: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

/** Simple modal confirm. */
export function ConfirmDialog({ title, children, confirmLabel, danger, busy, onConfirm, onCancel, testid, confirmDisabled = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" role="dialog" aria-modal="true" data-testid={testid}>
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-4 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={`${btn} border border-gray-300 dark:border-gray-600`} disabled={busy} onClick={onCancel}>Cancel</button>
          <button type="button" className={`${btn} text-white ${danger ? 'bg-red-600' : 'bg-blue-600'}`} disabled={busy || confirmDisabled} onClick={onConfirm} data-testid={testid ? `${testid}-yes` : undefined}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
