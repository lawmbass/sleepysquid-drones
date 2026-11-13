import { useEffect, useState } from "react";

const money = (cents) => `$${Math.round(Number(cents || 0) / 100)}`;

const PREVIEW = {
  testMode: true,
  referrers: [{
    id: "r1", name: "Mike Example", email: "mike.example@example.test", phone: "202-555-0148", code: "mike4821", active: true, payouts_enabled: false,
    links: {
      hub: "https://sleepysquid.com/r/mike4821",
      web: "https://sleepysquid.com/r/mike4821?to=web",
      drones: "https://sleepysquid.com/r/mike4821?to=drones",
      ai: "https://sleepysquid.com/r/mike4821?to=ai",
      home: "https://sleepysquid.com/referrals/you/preview",
    },
  }],
  requests: [{ id: "q1", name: "Avery Example", email: "avery.example@example.test", phone: "", note: "Neighbor. I send local businesses to SleepySquid.", status: "pending", archived_at: null }],
  referrals: [
    { id: "c1", referrer_id: "r1", customer_name: "Harbor Cafe", customer_email: "owner.example@example.test", business_line: "webdev", payment_status: "first_invoice_paid" },
    { id: "c2", referrer_id: "r1", customer_name: "Dana Client", customer_email: "dana.example@example.test", business_line: "drones", payment_status: "signed_up" },
  ],
  payouts: [
    { id: "p1", referral_id: "c1", amount_cents: 20000, status: "pending" },
  ],
};

function CopyLine({ label, value }) {
  const [copied, setCopied] = useState(false);
  return <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    <span className="flex items-center gap-2 min-w-0">
      <code className="truncate text-sm text-gray-800 dark:text-gray-100">{value}</code>
      <button type="button" className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy"}</button>
    </span>
  </div>;
}

export default function ReferralsSection({ preview = false }) {
  const [data, setData] = useState(preview ? PREVIEW : null);
  const [fresh, setFresh] = useState(preview ? { referrer: PREVIEW.referrers[0], links: PREVIEW.referrers[0].links } : null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  async function load() {
    if (preview) return;
    const response = await fetch("/api/admin/referrals", { credentials: "include" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Could not load referrals"); return; }
    setData(body);
    setError("");
  }
  useEffect(() => { load(); }, []);

  async function post(action, extra) {
    if (preview) return { ok: true };
    setError("");
    const response = await fetch("/api/admin/referrals", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error || "Could not save"); return null; }
    await load();
    return body;
  }

  const requests = (data?.requests || []).filter((row) => !row.archived_at && row.status === "pending");
  return <div className="space-y-8" data-testid="referrals-section">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referrals</h1>
      <p className="text-gray-600 dark:text-gray-300">One code works for websites, drones, and AI. A $200 fee is pending after the first eligible payment. Approving a payout sends money only with a Stripe test key.</p>
      {data && !data.testMode && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Transfers stay off until STRIPE_SECRET_KEY or STRIPE_HUB_SECRET_KEY is a test key.</p>}
    </div>
    {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add a referrer</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        const saved = await post("create", form);
        if (saved?.links) setFresh(saved);
        if (!preview) setForm({ name: "", email: "", phone: "", notes: "" });
      }}>
        <label className="text-sm font-medium">Name<input required className="mt-1 w-full rounded-md border px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-sm font-medium">Email<input required type="email" className="mt-1 w-full rounded-md border px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-sm font-medium">Phone (optional)<input className="mt-1 w-full rounded-md border px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="text-sm font-medium">Notes (optional)<input className="mt-1 w-full rounded-md border px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <div><button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" type="submit">Create link</button></div>
      </form>
      {fresh?.links && <div className="mt-4 space-y-2 rounded-md bg-blue-50 p-3" data-testid="new-links">
        <p className="font-semibold text-gray-900">Links for {fresh.referrer.name} · {fresh.referrer.code}</p>
        <CopyLine label="Referral link" value={fresh.links.hub} />
        <CopyLine label="Websites" value={fresh.links.web} />
        <CopyLine label="Drones" value={fresh.links.drones} />
        <CopyLine label="AI" value={fresh.links.ai} />
        {fresh.links.home && <CopyLine label="Their page" value={fresh.links.home} />}
      </div>}
    </section>
    <section>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Requests</h2>
      {!requests.length && <p className="text-sm text-gray-500">No pending requests.</p>}
      <ul className="mt-2 space-y-2">
        {requests.map((row) => <li key={row.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <p className="font-semibold">{row.name}</p>
          <p className="text-sm text-gray-600">{row.email}{row.phone ? ` · ${row.phone}` : ""}</p>
          {row.note && <p className="text-sm text-gray-700">{row.note}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white" onClick={() => post("approve-request", { id: row.id })}>Approve</button>
            <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => post("decline-request", { id: row.id })}>Decline</button>
            <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => post("archive-request", { id: row.id })}>Archive</button>
          </div>
        </li>)}
      </ul>
    </section>
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Referrers</h2>
      {(data?.referrers || []).filter((row) => !row.archived_at).map((row) => {
        const customers = (data.referrals || []).filter((item) => item.referrer_id === row.id);
        const fees = (data.payouts || []).filter((item) => customers.some((customer) => customer.id === item.referral_id) && item.status !== "void");
        const pending = fees.filter((item) => item.status === "pending" || item.status === "approved_awaiting_onboarding").reduce((sum, item) => sum + item.amount_cents, 0);
        const paid = fees.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount_cents, 0);
        return <article key={row.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{row.name} · {row.code}</h3>
              <p className="text-sm text-gray-600">{row.email} · {row.active === false ? "Inactive" : "Active"} · {money(pending)} pending · {money(paid)} paid</p>
            </div>
            <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => post(row.active === false ? "reactivate" : "deactivate", { id: row.id })}>{row.active === false ? "Reactivate" : "Deactivate"}</button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {customers.map((customer) => {
              const payout = fees.find((item) => item.referral_id === customer.id);
              return <li key={customer.id} className="flex justify-between gap-3 border-t border-gray-100 py-2">
                <span>{customer.customer_name || customer.customer_email} · {customer.business_line}</span>
                <span>{payout ? `${money(payout.amount_cents)} ${payout.status === "paid" ? "paid" : "pending"}` : customer.payment_status}</span>
                {payout?.status === "pending" && <button type="button" className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => post("approve-payout", { id: payout.id })}>Approve payout</button>}
              </li>;
            })}
            {!customers.length && <li className="text-gray-500">No referred customers yet.</li>}
          </ul>
        </article>;
      })}
    </section>
  </div>;
}
