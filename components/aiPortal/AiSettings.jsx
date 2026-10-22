// AI automation Settings: hourly rate + automation API key (ported from ai.sleepysquid.com/portal/settings).
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Tag from "./Tag";
import { DEFAULT_RATE } from "@/libs/aiPortal/tags";
const LOAD_ERR = "We couldn't load your settings right now. Please try again later.";
async function post(body) {
  const r = await fetch("/api/user/ai-portal-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "We couldn't save that right now. Please try again later."); return j;
}
function KeyPanel({ clientId, info: init, readOnly }) {
  const [info, setInfo] = useState(init), [confirm, setConfirm] = useState(false), [newKey, setNewKey] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(null), [copied, setCopied] = useState(false);
  const days = info ? Math.max(0, Math.ceil((Date.parse(info.expires_at) - Date.now()) / 86400000)) : null;
  async function rotate() { setBusy(true); setErr(null); try { const j = await post({ action: "rotate", client: clientId }); setNewKey(j.key); setInfo({ expires_at: j.expires_at }); setConfirm(false); } catch (e) { setErr(e.message); } setBusy(false); }
  return (<section className="p-panel" id="api-key"><h2>Automation API key</h2>
    <p className="p-sub">Your automations use this key to send reports to your dashboard.</p>
    <p className="p-keystat">{info ? <><b className={days <= 7 ? "warn" : ""}>{days} day{days === 1 ? "" : "s"}</b> left. Your API key expires on {info.expires_at.slice(0, 10)}. Generate a new one before then to avoid interruptions.</> : <>No active key.</>}</p>
    {newKey && <div className="p-newkey" role="status"><p><b>Copy this key now. For your security, we won&apos;t show it again.</b></p>
      <div className="p-keyrow"><code data-testid="new-key">{newKey}</code><button className="btn sm" onClick={() => { navigator.clipboard?.writeText(newKey); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button></div></div>}
    {err && <p className="p-err" role="alert">{err}</p>}
    {readOnly ? <p className="p-sub sm" data-testid="ro-key">Read only: key rotation is for the client.</p> : <button className="btn sm ghost" onClick={() => { setConfirm(true); setCopied(false); }}>Generate new key</button>}
    {confirm && !readOnly && <div className="a-modal" role="dialog" aria-modal="true" aria-labelledby="kdlg"><div className="a-modalbox">
      <h3 id="kdlg">Generate a new key?</h3><p>Generating a new key turns off your current key immediately. Anything using the old key will stop working until you update it.</p>
      <div className="a-modalbtns"><button className="btn sm ghost" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button><button className="btn sm" onClick={rotate} disabled={busy}>{busy ? "Generating…" : "Generate new key"}</button></div></div></div>}
  </section>);
}
export default function AiSettings() {
  const [q, setQ] = useState(""), [s, setS] = useState({ loading: true }), [rate, setRate] = useState(""), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const load = useCallback(async (client) => {
    try { const r = await fetch("/api/user/ai-portal-settings" + (client ? `?client=${encodeURIComponent(client)}` : "")); const j = await r.json().catch(() => ({})); setS(r.ok ? j : { error: LOAD_ERR }); }
    catch { setS({ error: LOAD_ERR }); }
  }, []);
  useEffect(() => { load(q); }, [q, load]);
  if (s.loading) return <div className="ai-portal"><p className="p-sub">Loading settings…</p></div>;
  if (s.error) return <div className="ai-portal"><section className="p-panel" data-testid="ai-error"><h2>AI automation</h2><p>{s.error}</p></section></div>;
  if (!s.linked) return <div className="ai-portal"><section className="p-panel" data-testid="ai-unlinked"><h2>AI automation</h2><p>No SleepySquid AI account is linked to this email yet. Contact <a href="mailto:support@sleepysquid.com">support@sleepysquid.com</a>.</p></section></div>;
  const { client, mine, readOnly, clients } = s;
  const back = `/dashboard?section=ai${clients.length > 1 ? `&client=${encodeURIComponent(client.id)}` : ""}`;
  async function save(useDefault) {
    setBusy(true); setMsg(null);
    try { await post({ action: "rate", client: client.id, hourly_wage: useDefault ? null : Number(rate) }); setMsg({ ok: useDefault ? "Back to area wages." : "Saved. Your dashboard now uses your rate." }); setRate(""); load(client.id); }
    catch (e) { setMsg({ err: e.message }); }
    setBusy(false);
  }
  return (<div className="ai-portal" data-testid="ai-settings">
    {readOnly && <p className="p-preview-note" role="note">Admin view: read only. Change a client&apos;s rate under Users.</p>}
    {clients.length > 1 && <div className="p-switch"><label htmlFor="ai-scl">Account</label><select id="ai-scl" value={client.id} onChange={(e) => setQ(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
    {client.is_example && <p className="p-example" role="note">EXAMPLE DATA: this is a demo client with sample numbers, not a real business.</p>}
    <div className="p-head"><div><h1>AI automation</h1><p className="p-sub">{client.name}</p></div></div>
    <section className="p-panel" id="rate"><h2>Your hourly rate</h2>
      <p className="p-sub">We start with area wages for each kind of task <Tag t="SOURCED: BLS" />. If you know what this work costs you per hour, use your own number instead <Tag t="CLIENT" />.</p>
      <p>Now using: <b data-testid="rate-now">{mine != null ? `$${Number(mine).toFixed(2)}/hour (your number)` : Number(client.hourly_rate) === DEFAULT_RATE ? `Default rate ($${DEFAULT_RATE}/hr), change it below` : "area wages (BLS, May 2025)"}</b></p>
      <div className="p-keyrow"><label htmlFor="ai-rate" className="sr">Hourly rate</label><input id="ai-rate" disabled={readOnly} className="p-input" type="number" min="1" max="1000" step="0.01" placeholder="e.g. 35.00" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button className="btn sm" disabled={readOnly || busy || !(Number(rate) > 0)} onClick={() => save(false)}>Use my rate</button>
        {mine != null && <button className="btn sm ghost" disabled={readOnly || busy} onClick={() => save(true)}>Use area wages</button>}</div>
      {msg?.ok && <p className="p-ok">{msg.ok} <Link href={back}>View report</Link></p>}{msg?.err && <p className="p-err">{msg.err}</p>}
    </section>
    <KeyPanel key={client.id} clientId={client.id} info={s.keyInfo} readOnly={readOnly} />
  </div>);
}
