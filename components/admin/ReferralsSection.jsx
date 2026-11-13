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
  if (payout.status === "paid" && payout.stripe_transfer_id) {
    const when = emailedOn(payout.paid_at);
    return when ? `Paid via Stripe ${when}` : "Paid via Stripe";
  }
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

function Badge({ tone = "gray", children }) {
  const tones = {
    green: "bg-green-50 text-green-800",
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-900",
    blue: "bg-blue-50 text-blue-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.gray}`}>{children}</span>;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy"}</button>;
}

const LINK_ROWS = [
  ["Referral link", "hub"],
  ["Websites", "web"],
  ["Drones", "drones"],
  ["AI", "ai"],
  ["Their page", "home"],
];

function LinkCopies({ links }) {
  if (!links) return null;
  return <ul className="mt-3 space-y-1.5" data-testid="referrer-links">
    {LINK_ROWS.map(([label, key]) => links[key] ? <li key={key} className="flex min-w-0 items-center gap-2">
      <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <code className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-200">{links[key]}</code>
      <CopyButton value={links[key]} />
    </li> : null)}
  </ul>;
}

function Stat({ label, value }) {
  return <div className="min-w-0 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-1 truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
  </div>;
}

const mikeLinks = {
  hub: "https://sleepysquid.com/r/mike4821",
  web: "https://sleepysquid.com/r/mike4821?to=web",
  drones: "https://sleepysquid.com/r/mike4821?to=drones",
  ai: "https://sleepysquid.com/r/mike4821?to=ai",
  home: "https://sleepysquid.com/referrals/you/preview",
};

const PREVIEW = {
  referrers: [{
    id: "r1", name: "Mike Example", email: "mike.example@example.test", phone: "202-555-0148", code: "mike4821", active: true, payouts_enabled: true,
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
    { id: "c4", referrer_id: "r1", customer_name: "Oak Market", customer_email: "oak.example@example.test", business_line: "webdev", payment_status: "first_invoice_paid" },
  ],
  payouts: [
    { id: "p1", referral_id: "c1", amount_cents: 20000, status: "pending" },
    { id: "p2", referral_id: "c3", amount_cents: 20000, status: "approved_awaiting_onboarding" },
    { id: "p3", referral_id: "c4", amount_cents: 20000, status: "paid", stripe_transfer_id: "tr_preview", paid_at: "2026-11-13T15:04:00.000Z" },
  ],
};

const EMPTY = { referrers: [], requests: [], referrals: [], payouts: [] };

const field = "mt-1 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900";
const ghost = "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
const primary = "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50";

export default function ReferralsSection({ preview = false, state = "ready", confirmOpen = false }) {
  const [data, setData] = useState(preview ? (state === "empty" ? EMPTY : PREVIEW) : null);
  const [fresh, setFresh] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [confirmPayout, setConfirmPayout] = useState(preview && confirmOpen ? { id: "p1", name: "Mike Example", amount: 20000 } : null);

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
  const referrers = (data?.referrers || []).filter((row) => !row.archived_at);
  const customers = (data?.referrals || []).filter((row) => row.payment_status !== "void");
  const payouts = data?.payouts || [];
  const pendingCents = payouts.filter((row) => row.status === "pending" || row.status === "approved_awaiting_onboarding").reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
  const paidCents = payouts.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
  const activeCount = referrers.filter((row) => row.active !== false).length;

  return <div className="min-w-0 space-y-6 overflow-x-hidden" data-testid="referrals-section">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referrals</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">One code works for websites, drones, and AI. A referrer earns $200 on the first eligible payment from someone they refer. {data?.connectConfigured ? "Mark approved sends $200 to referrers who have set up payouts. Others you pay yourself." : "Payouts are manual. Approve here, then pay them yourself."}</p>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Active referrers" value={String(activeCount)} />
      <Stat label="Referred customers" value={String(customers.length)} />
      <Stat label="Pending" value={money(pendingCents)} />
      <Stat label="Paid" value={money(paidCents)} />
    </div>
    {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
    {confirmPayout && <div role="dialog" aria-modal="true" aria-labelledby="payout-confirm-title" className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p id="payout-confirm-title" className="font-semibold text-gray-900">Send {money(confirmPayout.amount)} to {confirmPayout.name}?</p>
      <p className="mt-1 text-sm text-gray-700">This sends the referral fee to their payout account.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primary} onClick={async () => { const id = confirmPayout.id; setConfirmPayout(null); await post("approve-payout", { id }); }}>Send</button>
        <button type="button" className={ghost} onClick={() => setConfirmPayout(null)}>Cancel</button>
      </div>
    </div>}
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add a referrer</h2>
      <form className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        const saved = await post("create", form);
        if (saved?.links) setFresh(saved);
        if (!preview) setForm({ name: "", email: "", phone: "", notes: "" });
      }}>
        <label className="min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200">Name<input required className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200">Email<input required type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200">Phone (optional)<input className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200">Notes (optional)<input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <div><button className={primary} type="submit">Create link</button></div>
      </form>
      {fresh?.links && <div className="mt-4 min-w-0 rounded-md bg-blue-50 p-3" data-testid="new-links">
        <p className="font-semibold text-gray-900">Links for {fresh.referrer.name} · {fresh.referrer.code}</p>
        <LinkCopies links={fresh.links} />
      </div>}
    </section>
    <section className="min-w-0 space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Requests</h2>
      {!requests.length && <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800">No pending requests.</p>}
      <ul className="space-y-2">
        {requests.map((row) => <li key={row.id} className="min-w-0 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white">{row.name}</p>
              <p className="break-all text-sm text-gray-600 dark:text-gray-300">{row.email}{row.phone ? ` · ${row.phone}` : ""}</p>
            </div>
            <Badge tone="amber">Pending</Badge>
          </div>
          {row.note && <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{row.note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={() => post("approve-request", { id: row.id })}>Approve</button>
            <button type="button" className={ghost} onClick={() => post("decline-request", { id: row.id })}>Decline</button>
            <button type="button" className={ghost} onClick={() => post("archive-request", { id: row.id })}>Archive</button>
          </div>
        </li>)}
      </ul>
    </section>
    <section className="min-w-0 space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Referrers</h2>
      {!referrers.length && <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800">No referrers yet. Add one above.</p>}
      {referrers.map((row) => {
        const theirs = customers.filter((item) => item.referrer_id === row.id);
        const fees = payouts.filter((item) => theirs.some((customer) => customer.id === item.referral_id) && item.status !== "void");
        const toPay = fees.filter((item) => item.status === "pending" || item.status === "approved_awaiting_onboarding").reduce((sum, item) => sum + item.amount_cents, 0);
        const paid = fees.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount_cents, 0);
        const emailed = emailedOn(row.link_email_sent_at);
        return <article key={row.id} className="min-w-0 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white">{row.name} <span className="font-normal text-gray-500">· {row.code}</span></h3>
              <p className="break-all text-sm text-gray-600 dark:text-gray-300">{row.email || "No email"} · {money(toPay)} to pay · {money(paid)} paid</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={row.active === false ? "gray" : "green"}>{row.active === false ? "Inactive" : "Active"}</Badge>
                {row.payouts_enabled ? <Badge tone="blue">Payouts set up</Badge> : <Badge tone="gray">Payouts not set up</Badge>}
                {emailed ? <span className="text-sm text-gray-600 dark:text-gray-300" data-testid="referrer-email-state">Emailed {emailed}</span> : null}
                {row.link_email_error ? <span data-testid="referrer-email-state"><Badge tone="red">Email failed</Badge></span> : null}
                {!emailed && !row.link_email_error ? <span className="text-sm text-gray-500" data-testid="referrer-email-state">Not emailed yet</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={ghost} data-testid="resend-link-email" disabled={!String(row.email || "").trim() || busy === `resend-link:${row.id}`} onClick={() => post("resend-link", { id: row.id })}>Resend link email</button>
              <button type="button" className={ghost} onClick={() => post(row.active === false ? "reactivate" : "deactivate", { id: row.id })}>{row.active === false ? "Reactivate" : "Deactivate"}</button>
            </div>
          </div>
          <LinkCopies links={row.links} />
          <ul className="mt-3 space-y-1 text-sm">
            {theirs.map((customer) => {
              const payout = fees.find((item) => item.referral_id === customer.id);
              return <li key={customer.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 py-2 dark:border-gray-700">
                <span className="min-w-0 break-words">{customer.customer_name || customer.customer_email}{lineName(customer.business_line) ? ` · ${lineName(customer.business_line)}` : ""}</span>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <span data-testid="payout-state">{payout ? payoutState(payout) : customerState(customer)}</span>
                  {payout?.status === "pending" && <button type="button" className={primary} onClick={() => (row.payouts_enabled ? setConfirmPayout({ id: payout.id, name: row.name, amount: payout.amount_cents }) : post("approve-payout", { id: payout.id }))}>Mark approved</button>}
                </span>
              </li>;
            })}
            {!theirs.length && <li className="border-t border-gray-100 py-2 text-gray-500 dark:border-gray-700">No referred customers yet.</li>}
          </ul>
        </article>;
      })}
    </section>
  </div>;
}
