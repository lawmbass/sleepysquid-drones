// "AI automation" section of the unified dashboard: the SleepySquid AI client report (same data and rules as
// ai.sleepysquid.com/portal). Outcome-only cards and charts; errors and test automations are admin-only.
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { DEFINITIONS, FOOTER, LEGEND, headline, plural, plainTag, DEFAULT_RATE, shortDate } from "@/libs/aiPortal/tags";
import Tag from "./Tag";
const Charts = dynamic(() => import("./Charts").then((m) => m.Charts), { ssr: false, loading: () => <p className="p-sub">Loading charts…</p> });

const DAY = 86400000, iso = (d) => d.toISOString().slice(0, 10);
const TYPE = { landscaper: "Landscaping", real_estate_agent: "Real estate agent", property_manager: "Property management", small_business: "Small business" };
const when = (s, tz) => new Date(s).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const SETTINGS = "/dashboard?section=settings#ai-automation";
function ranges(today) {
  const t = new Date(today + "T00:00:00Z"), y = t.getUTCFullYear(), m = t.getUTCMonth();
  return [["This month", iso(new Date(Date.UTC(y, m, 1))), today], ["Last month", iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))], ["Last 90 days", iso(new Date(t - 89 * DAY)), today]];
}

export default function AiAutomationContent() {
  const [q, setQ] = useState({});
  const [state, setState] = useState({ loading: true });
  const load = useCallback(async (params) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await fetch("/api/user/ai-portal?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString());
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setState({ error: j.error || "We couldn't load your automation report right now. Please try again later." });
      else setState(j);
    } catch { setState({ error: "We couldn't load your automation report right now. Please try again later." }); }
  }, []);
  useEffect(() => { load(q); }, [q, load]);

  if (state.loading && !state.d) return <div className="ai-portal"><p className="p-sub">Loading your automation report…</p></div>;
  if (state.error) return <div className="ai-portal"><section className="p-panel" data-testid="ai-error"><h2>AI automation</h2><p>{state.error}</p></section></div>;
  if (!state.linked) return <div className="ai-portal"><section className="p-panel" data-testid="ai-unlinked"><h2>AI automation</h2><p>No SleepySquid AI account is linked to this email yet. If you&apos;re a client, sign in with the email address we set your account up with, or contact <a href="mailto:support@sleepysquid.com">support@sleepysquid.com</a>.</p></section></div>;

  const { d, clients, admin, today, keyInfo } = state;
  const { client, from, to } = d;
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: client.currency, maximumFractionDigits: 0 });
  const money = (v) => fmt.format(v);
  const multi = clients.length > 1;
  const set = (p) => setQ({ client: client.id, from, to, ...p });
  const wages = d.rates.map((r) => r.wage), lo = Math.min(...wages), hi = Math.max(...wages);
  const rateText = d.rateIsDefault ? `the default rate ($${DEFAULT_RATE}/hr)` : !d.rates.length ? `${money(client.hourly_rate)}/hour` : lo === hi ? `$${lo.toFixed(2)}/hour` : `area wages of $${lo.toFixed(2)}–$${hi.toFixed(2)}/hour`;
  const need = d.attention || [], infoNotes = d.issueNotes || [];
  const ratio = d.planPrice ? d.totals.dollars / (d.planPrice * Math.max(1, (Date.parse(to) - Date.parse(from)) / DAY + 1) / 30.44) : null;
  const noData = !d.lastUpdated, emptyRange = !noData && !d.workflows.length;
  const collecting = !noData && !(d.totals.dollars > 0);
  const hl = collecting ? null : headline(d, money);
  const summary = d.weekSummary.length ? `This week your automations ${d.weekSummary.join(" and ")}.` : null;
  return (<div className="ai-portal" data-testid="ai-portal" aria-busy={state.loading ? "true" : "false"}>
    {admin && <p className="p-preview-note" role="note">Admin view: you can pick any client. Clients only see their own account, without the admin-only panels.</p>}
    {multi && <div className="p-switch"><label htmlFor="ai-cl">Account</label><select id="ai-cl" value={client.id} onChange={(e) => set({ client: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
    {client.is_example && <p className="p-example" role="note">EXAMPLE DATA: this is a demo client with sample numbers, not a real business.</p>}
    {keyInfo && Date.parse(keyInfo.expires_at) - Date.now() <= 7 * DAY && <p className="p-info" role="alert" data-testid="key-expiry">Your automation API key expires on {keyInfo.expires_at.slice(0, 10)}. <a href={SETTINGS}>Generate a new one in Settings</a> to avoid interruptions.</p>}
    {client.texting_status === "pending" && <p className="p-info">Text messages start once carrier approval comes through, usually 1–3 weeks. Email is already running.</p>}
    <div className="p-head">
      <div><h1>{client.name}</h1>
        {summary && <p className="p-headline" data-testid="summary">{summary}</p>}
        {hl && <p className="p-sub">{hl}</p>}
        <p className="p-sub">{TYPE[d.businessType]} · {d.rateIsDefault ? <>Estimates use the <span data-testid="default-rate">Default rate (${DEFAULT_RATE}/hr)</span>. <a href={SETTINGS}>Change it in Settings</a></> : <>Estimates use {rateText}. <a href={SETTINGS}>Change your rate in Settings</a></>}</p>
        {d.lastUpdated && <p className="p-sub sm2" data-testid="last-updated">Last updated {when(d.lastUpdated, client.timezone)}</p>}
        <div className="p-actions"><a className="btn sm ghost" data-testid="export-pdf" href={`/api/user/ai-portal-pdf?${new URLSearchParams({ client: client.id, from, to })}`}>Export PDF</a>{admin && <Link className="btn sm ghost" href="/dashboard?section=users" data-testid="manage-clients">Manage AI clients</Link>}</div></div>
      <div className="p-range">
        <div className="p-quick">{ranges(today).map(([l, f, t]) => <button type="button" key={l} className={`p-chip${f === from && t === to ? " on" : ""}`} onClick={() => set({ from: f, to: t })}>{l}</button>)}</div>
        <label>From<input type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} /></label>
        <label>To<input type="date" value={to} onChange={(e) => e.target.value && set({ to: e.target.value })} /></label>
      </div>
    </div>
    {noData ? <section className="p-panel" data-testid="empty"><h2>Collecting data</h2><p>First numbers by {shortDate(d.firstNumbersBy, client.timezone)}. Your numbers show here about a week after the first automation reports in.</p></section> : <>
    <h2 className="p-rowhead">Estimates</h2>
    <section className="p-stats">
      {collecting ? <div className="p-stat wide hero" data-testid="collecting"><span>Est. value saved</span><b className="p-collect">Collecting data</b><small>First numbers by {shortDate(d.firstNumbersBy, client.timezone)}</small></div> : <>
      <div className="p-stat wide hero" data-testid="value"><span>Est. value saved</span><b>{money(d.totals.dollars)}</b>{ratio != null && <small className="p-ratio">{ratio.toFixed(1)}x your plan ({money(d.planPrice)}/mo)</small>}<a href="#how" className="p-how">How we calculate this</a></div>
      <div className="p-stat hero" data-testid="hours"><span>Est. hours saved</span><b>{d.totals.hours.toFixed(1)}</b><a href="#how" className="p-how">How we calculate this</a></div></>}
    </section>
    {emptyRange ? <section className="p-panel"><p>Nothing ran between {from} and {to}. Try a wider range.</p></section> : <>
    <h2 className="p-rowhead">Counted</h2>
    {d.headlineTiles.length === 0 ? <section className="p-stats"><div className="p-stat full" data-testid="counted-collecting"><span>Counted</span><b className="p-collect">Collecting data</b><small>First numbers by {shortDate(d.firstNumbersBy, client.timezone)}</small></div></section> :
    <section className="p-stats" data-testid="tiles">{d.headlineTiles.map((t) => <div className="p-stat sm" key={t.key}><span>{t.label}</span><b>{Math.round(t.value).toLocaleString()}</b>{DEFINITIONS[t.key] && <small>{DEFINITIONS[t.key]}</small>}</div>)}</section>}
    {d.recontacted != null && <p className="p-sub sm2" data-testid="recontacted">Leads re-contacted: {Math.round(d.recontacted).toLocaleString()}</p>}
    </>}
    <section className="p-stats"><div className="p-stat full" data-testid="live"><span>Automations</span><b>{plural(d.reportingCount, "automation")} reporting</b></div></section>
    {!emptyRange && d.weekly.length > 0 && <Charts d={d} money={money} />}
    {admin && (need.length > 0 || infoNotes.length > 0) && <section className="p-panel p-admin-only" data-testid="admin-errors"><h2><span className="p-admin-badge">Admin only</span> Bot reports</h2><p className="p-sub sm">Hidden from the client.</p>
      <h3 className="p-issue-head" data-testid="needs-attention">Needs attention ({need.length})</h3>
      {need.length ? <ul className="p-wins p-issues">{need.map((a, i) => <li key={i}><time>{shortDate(a.at, client.timezone)}</time><span><b>{a.name}</b>: {a.note}{a.fix && <small className="p-fix">Fix: {a.fix}</small>}</span></li>)}</ul> : <p className="p-sub sm">Nothing needs attention.</p>}
      {infoNotes.length > 0 && <><h3 className="p-issue-head" data-testid="issue-notes">Notes ({infoNotes.length})</h3>
      <ul className="p-wins p-issues p-notes">{infoNotes.map((a, i) => <li key={i}><time>{shortDate(a.at, client.timezone)}</time><span><b>{a.name}</b>: {a.noDetails ? <i>No details sent</i> : a.note}</span></li>)}</ul></>}</section>}
    </>}
    {admin && d.testAutomations?.length > 0 && <section className="p-panel p-admin-only" data-testid="admin-tests"><h2><span className="p-admin-badge">Admin only</span> Test automations ({d.testAutomations.length})</h2><p className="p-sub sm">Connection tests and setup checks. Hidden from the client.</p>
      <ul className="p-wins">{d.testAutomations.map((a) => <li key={a.id}><time>test</time><span><b>{a.name}</b> <code>{a.id}</code>: {plural(a.reports, "report")} in this view</span></li>)}</ul></section>}
    <section className="p-panel" id="how"><h2>How we calculate this</h2>
      <div className="p-tablewrap"><table className="p-table"><thead><tr><th>Task</th><th>Applies to</th><th>Minutes by hand</th><th>Hourly wage</th><th>Value each time</th></tr></thead>
        <tbody>{d.legacyTimings.map((t, i) => <tr key={"l" + i}><td>{t.label}</td><td>{t.automation}</td><td>{t.minutes}</td><td>${Number(client.hourly_rate).toFixed(2)}{d.rateIsDefault ? " (default)" : ""}</td><td>${(t.minutes / 60 * client.hourly_rate).toFixed(2)}</td></tr>)}{d.rates.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.metrics.join(", ") || "-"}</td><td>{r.minutes} <Tag t={r.minutesTag} /></td><td>${r.wage.toFixed(2)} <Tag t={r.wageTag} /></td><td>${r.unitValue.toFixed(2)} <Tag t={r.tag} /></td></tr>)}</tbody></table></div>
      <p className="p-legend">{LEGEND.map((l) => { const k = { "Counted": "SOURCED: bot", "Area wage (BLS, May 2025)": "SOURCED: BLS", "Estimate": "ESTIMATE", "Your number": "CLIENT" }[l]; return <span key={l}><Tag t={k} /> {plainTag(k).tip}</span>; })}</p>
      <p className="p-fine">Counted results (like leads qualified) are never turned into dollars.</p>
    </section>
    <p className="p-fine">{FOOTER}</p>
  </div>);
}

// Compact card for the dashboard overview. Renders nothing unless the user is linked to an AI client.
export function AiSummaryCard({ onOpen }) {
  const [s, setS] = useState(null);
  useEffect(() => { fetch("/api/user/ai-portal?summary=1").then((r) => (r.ok ? r.json() : null)).then((j) => j?.linked && setS(j.summary)).catch(() => {}); }, []);
  if (!s) return null;
  const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: s.currency || "USD", maximumFractionDigits: 0 }).format(v);
  return (<div className="ai-portal ai-summary" data-testid="ai-summary"><div className="p-panel">
    <h2>AI automation · {s.clientName}</h2>
    {s.collecting ? <p className="p-sub">Collecting data. Your numbers show here about a week after the first automation reports in.</p> :
      <p className="p-sub">Last 30 days: est. <b>{money(s.dollars)}</b> saved, <b>{s.hours.toFixed(1)}</b> hours, {plural(s.reporting, "automation")} reporting.</p>}
    <Link className="p-how" href="/dashboard?section=ai" onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(); } }}>Open AI automation report</Link>
  </div></div>);
}
