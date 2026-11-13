import { useEffect, useState } from "react";

const money = (cents) => `$${Math.round(Number(cents || 0) / 100)}`;

function lineName(line) {
  if (line === "webdev") return "Websites";
  if (line === "drones") return "Drones";
  if (line === "ai") return "AI";
  return "";
}

function customerState(customer) {
  if (customer.payment_status === "signed_up") return "Signed up";
  if (customer.payment_status === "first_invoice_paid") return "First payment received";
  if (customer.payment_status === "void") return "Voided";
  return "Signed up";
}

function payoutState(payout) {
  if (payout.status === "paid") return `${money(payout.amount_cents)} paid`;
  if (payout.status === "approved_awaiting_onboarding") return "Approved, pay manually";
  return `${money(payout.amount_cents)} pending`;
}

function emailedOn(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

const mikeLinks = {
  hub: "https://sleepysquid.com/r/mike4821",
  web: "https://sleepysquid.com/r/mike4821?to=web",
  drones: "https://sleepysquid.com/r/mike4821?to=drones",
  ai: "https://sleepysquid.com/r/mike4821?to=ai",
  home: "https://sleepysquid.com/referrals/you/preview",
};

const PREVIEW = {
  testMode: true,
  referrers: [{
    id: "r1", name: "Mike Example", email: "mike.example@example.test", phone: "202-555-0148", code: "mike4821", active: true, payouts_enabled: false,
    link_email_sent_at: "2026-11-13T15:04:00.000Z", link_email_error: null,
    links: mikeLinks,
  }, {
    id: "r2", name: "Sam Example", email: "sam.example@example.test", phone: "", code: "sam1094", active: true, payouts_enabled: false,
    link_email_sent_at: null, link_email_error: "Could not send the referral email",
    links: {
      hub: "https://sleepysquid.com/r/sam1094",
      web: "https://sleepysquid.com/r/sam1094?to=web",
      drones: "https://sleepysquid.com/r/sam1094?to=drones",
      ai: "https://sleepysquid.com/r/sam1094?to=ai",
      home: "https://sleepysquid.com/referrals/you/preview-sam",
    },
  }],
  requests: [{ id: "q1", name: "Avery Example", email: "avery.example@example.test", phone: "", note: "Neighbor. I send local businesses to SleepySquid.", status: "pending", archived_at: null }],
  referrals: [
    { id: "c1", referrer_id: "r1", customer_name: "Harbor Cafe", customer_email: "owner.example@example.test", business_line: "webdev", payment_status: "first_invoice_paid" },
    { id: "c2", referrer_id: "r1", customer_name: "Dana Client", customer_email: "dana.example@example.test", business_line: "drones", payment_status: "signed_up" },
    { id: "c3", referrer_id: "r1", customer_name: "North Pier", customer_email: "pier.example@example.test", business_line: "ai", payment_status: "first_invoice_paid" },
  ],
  payouts: [
    { id: "p1", referral_id: "c1", amount_cents: 20000, status: "pending" },
    { id: "p2", referral_id: "c3", amount_cents: 20000, status: "approved_awaiting_onboarding" },
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
  const [busy, setBusy] = useState("");
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
    setBusy(`${action}:${extra?.id || ""}`);
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Could not save"); return null; }
      await load();
      if (body.email?.error) setError(body.email.error);
      else if (body.email?.sent && body.email.recorded === false) setError("Email sent. The sent date could not be saved.");
      return body;
    } finally {
      setBusy("");
    }
  }

  const requests = (data?.requests || []).filter((row) => !row.archived_at && row.status === "pending");
  return <div className="space-y-8" data-testid="referrals-section">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referrals</h1>
      <p className="text-gray-600 dark:text-gray-300">One code works for websites, drones, and AI. A referrer earns $200 on the first eligible payment from someone they refer. Payouts are manual. Approve here, then pay them yourself.</p>
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
        const toPay = fees.filter((item) => item.status === "pending" || item.status === "approved_awaiting_onboarding").reduce((sum, item) => sum + item.amount_cents, 0);
        const paid = fees.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount_cents, 0);
        const emailed = emailedOn(row.link_email_sent_at);
        return <article key={row.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{row.name} · {row.code}</h3>
              <p className="text-sm text-gray-600">{row.email || "No email"} · {row.active === false ? "Inactive" : "Active"} · {money(toPay)} to pay · {money(paid)} paid</p>
              <p className="text-sm" data-testid="referrer-email-state">
                {emailed ? <span className="text-gray-600">Emailed {emailed}</span> : null}
                {row.link_email_error ? <span className="text-red-700" role="alert">{emailed ? " · Email failed" : "Email failed"}</span> : null}
                {!emailed && !row.link_email_error ? <span className="text-gray-500">Not emailed yet</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border px-3 py-1 text-sm disabled:opacity-50" data-testid="resend-link-email" disabled={!String(row.email || "").trim() || busy === `resend-link:${row.id}`} onClick={() => post("resend-link", { id: row.id })}>Resend link email</button>
              <button type="button" className="rounded-md border px-3 py-1 text-sm" onClick={() => post(row.active === false ? "reactivate" : "deactivate", { id: row.id })}>{row.active === false ? "Reactivate" : "Deactivate"}</button>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {customers.map((customer) => {
              const payout = fees.find((item) => item.referral_id === customer.id);
              return <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 py-2">
                <span>{customer.customer_name || customer.customer_email}{lineName(customer.business_line) ? ` · ${lineName(customer.business_line)}` : ""}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span data-testid="payout-state">{payout ? payoutState(payout) : customerState(customer)}</span>
                  {payout?.status === "pending" && <button type="button" className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => post("approve-payout", { id: payout.id })}>Mark approved</button>}
                </span>
              </li>;
            })}
            {!customers.length && <li className="text-gray-500">No referred customers yet.</li>}
          </ul>
        </article>;
      })}
    </section>
  </div>;
}
