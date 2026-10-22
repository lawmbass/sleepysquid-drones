import { useEffect, useState } from 'react';
import ServiceChip from './ServiceChip';

function money(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format((cents || 0) / 100);
}

function when(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Empty({ children }) {
  return <p className="text-sm text-gray-400 dark:text-gray-500 italic">{children}</p>;
}

function SourceNote({ sources }) {
  const notes = [];
  if (sources.stripe === 'not_configured') notes.push('Stripe is not connected on this deployment, so revenue and subscribers are not shown.');
  if (sources.stripe === 'error') notes.push('Stripe could not be reached. Revenue and subscribers are not shown.');
  if (sources.bookings === 'error') notes.push('Bookings could not be loaded. Clients and upcoming jobs from bookings are not shown.');
  if (!notes.length) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {notes.map((n) => <p key={n}>{n}</p>)}
    </div>
  );
}

export default function HubOverview({ data: injected }) {
  const [data, setData] = useState(injected || null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (injected) return;
    let cancelled = false;
    fetch('/api/admin/hub/overview', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((body) => { if (!cancelled) setData(body.data); })
      .catch(() => { if (!cancelled) setError('Could not load the overview. Please refresh.'); });
    return () => { cancelled = true; };
  }, [injected]);

  if (error) return <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-6 text-sm text-red-600">{error}</div>;
  if (!data) {
    return <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-6 text-sm text-gray-500">Loading overview…</div>;
  }

  const stripeOk = data.sources.stripe === 'ok';
  const bookingsOk = data.sources.bookings === 'ok';

  return (
    <section className="space-y-4" aria-label="All services overview">
      <SourceNote sources={data.sources} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active clients</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{data.totals.activeClients}</p>
          <p className="mt-1 text-xs text-gray-400">Booked in the last 90 days or upcoming, plus active Stripe subscribers</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Revenue, last {data.revenueWindowDays} days</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{stripeOk ? money(data.totals.revenueCents, data.currency) : '—'}</p>
          <p className="mt-1 text-xs text-gray-400">Paid Stripe invoices, grouped by product service tag</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800 shadow p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming jobs</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{bookingsOk ? data.totals.upcomingJobs : '—'}</p>
          <p className="mt-1 text-xs text-gray-400">Open bookings dated today or later</p>
        </div>
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">By service</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-700 md:grid-cols-3 md:divide-y-0 md:divide-x">
          {data.services.map((s) => {
            const hasAny = s.activeClients > 0 || s.revenueCents > 0 || s.upcomingJobs > 0;
            return (
              <div key={s.id} className="p-5 space-y-3">
                <ServiceChip id={s.id} />
                {!hasAny ? (
                  <Empty>No {s.label} data yet.</Empty>
                ) : (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Active clients</dt><dd className="font-medium text-gray-900 dark:text-white">{s.activeClients}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Revenue</dt><dd className="font-medium text-gray-900 dark:text-white">{stripeOk ? (s.revenueCents ? money(s.revenueCents, data.currency) : 'None yet') : '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Upcoming jobs</dt><dd className="font-medium text-gray-900 dark:text-white">{s.upcomingJobs}</dd></div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
        {stripeOk && data.untaggedRevenueCents > 0 && (
          <p className="px-6 pb-4 text-xs text-gray-400">{money(data.untaggedRevenueCents, data.currency)} came from invoice lines without a service tag and is not counted above.</p>
        )}
      </div>

      <div className="rounded-lg bg-white dark:bg-gray-800 shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Upcoming jobs, all services</h2>
        </div>
        {data.upcoming.length === 0 ? (
          <div className="px-6 py-6"><Empty>No upcoming jobs.</Empty></div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.upcoming.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <ServiceChip id={job.serviceLine} />
                  <span className="truncate text-gray-900 dark:text-white">{job.name}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <span className="capitalize">{job.status}</span>
                  <span>{when(job.date)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
