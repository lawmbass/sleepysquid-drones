// Manage AI clients (admins only; ported from ai.sleepysquid.com/portal/admin). The API re-checks admin server-side.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
async function call(body) {
  const r = await fetch("/api/user/ai-portal-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work. Please try again."); return j;
}
function Confirm({ c, kind, onClose, onDone }) {
  const [typed, setTyped] = useState(""), [err, setErr] = useState(null), [busy, setBusy] = useState(false), purge = kind === "purge";
  async function go(e) { e.preventDefault(); setBusy(true); setErr(null); try { await call({ action: kind, id: c.id, confirm_name: typed }); onDone(); } catch (x) { setErr(x.message); setBusy(false); } }
  return (<div className="a-modal" role="dialog" aria-modal="true" aria-labelledby={`dlg-${c.id}`}><form className="a-modalbox" onSubmit={go}>
    <h3 id={`dlg-${c.id}`}>{purge ? `Permanently delete ${c.name}?` : `Delete ${c.name}?`}</h3>
    {purge ? <p className="a-warn" role="alert"><b>This can&apos;t be undone.</b> All of this client&apos;s reports, API keys, automations and login emails are erased for good, along with the client itself.</p>
      : <p>Their login email stops working and their API keys are revoked so their bots get 401. Reports are kept. You can restore the client later from &quot;Show deleted&quot;.</p>}
    <label><span>Type <b>{c.name}</b> to confirm</span><input className="p-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus data-testid="confirm-name" /></label>
    {err && <p className="p-err">{err}</p>}
    <div className="a-modalbtns"><button type="button" className="btn sm ghost" onClick={onClose}>Cancel</button><button className="btn sm danger" disabled={busy || typed.trim() !== c.name} data-testid="confirm-go">{busy ? "Deleting…" : purge ? "Delete permanently" : "Delete client"}</button></div>
  </form></div>);
}
function Row({ c, reload }) {
  const [edit, setEdit] = useState(false), [name, setName] = useState(c.name), [email, setEmail] = useState(c.emails[0] || ""), [rate, setRate] = useState(String(c.hourly_rate ?? "")), [err, setErr] = useState(null), [busy, setBusy] = useState(false), [dlg, setDlg] = useState(null);
  async function act(body) { setBusy(true); setErr(null); try { await call(body); setEdit(false); reload(); } catch (x) { setErr(x.message); } setBusy(false); }
  return (<div className="p-row a-row" data-testid="client-row">{edit ? <form className="a-form a-form4" onSubmit={(e) => { e.preventDefault(); act({ action: "update", id: c.id, name, email, hourly_rate: rate }); }}>
      <label>Client name<input className="p-input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Login email<input className="p-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Hourly rate ($/hr)<input className="p-input" type="number" min="1" max="1000" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
      <div className="p-dbtns"><button type="button" className="btn sm ghost" onClick={() => setEdit(false)}>Cancel</button><button className="btn sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      {err && <p className="p-err">{err}</p>}</form> :
    <><div className="p-rname"><b>{c.name}</b><span>{c.emails.join(", ") || "no login email"} · ${Number(c.hourly_rate).toFixed(2)}/hr{c.is_example ? " · EXAMPLE" : ""}</span></div>
      {c.deleted_at ? <div className="a-actions"><button className="btn sm" onClick={() => act({ action: "restore", id: c.id })} disabled={busy}>Restore client</button><button className="btn sm danger" onClick={() => setDlg("purge")} disabled={busy}>Delete permanently</button></div> :
      <div className="a-actions"><Link className="btn sm" href={`/dashboard?section=ai&client=${encodeURIComponent(c.id)}`}>View report</Link><button className="btn sm ghost" onClick={() => setEdit(true)}>Edit</button><button className="btn sm danger" onClick={() => setDlg("delete")}>Delete client</button></div>}
      {err && <p className="p-err">{err}</p>}{dlg && <Confirm c={c} kind={dlg} onClose={() => setDlg(null)} onDone={() => { setDlg(null); reload(); }} />}</>}</div>);
}
export default function AiAdmin() {
  const [deleted, setDeleted] = useState(false), [s, setS] = useState({ loading: true });
  const [name, setName] = useState(""), [login, setLogin] = useState(""), [rate, setRate] = useState("19"), [err, setErr] = useState(null), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch(`/api/user/ai-portal-admin${deleted ? "?deleted=1" : ""}`); const j = await r.json().catch(() => ({})); setS(r.ok ? j : { error: r.status === 403 ? "You don't have access to this page." : "Couldn't load clients. Please try again." }); }
    catch { setS({ error: "Couldn't load clients. Please try again." }); }
  }, [deleted]);
  useEffect(() => { load(); }, [load]);
  if (s.loading) return <div className="ai-portal"><p className="p-sub">Loading clients…</p></div>;
  if (s.error) return <div className="ai-portal"><section className="p-panel" data-testid="ai-error"><h2>Manage AI clients</h2><p>{s.error}</p></section></div>;
  async function add(e) { e.preventDefault(); setBusy(true); setErr(null); try { await call({ action: "create", name, email: login, hourly_rate: rate }); setName(""); setLogin(""); setRate(String(s.defaultRate)); load(); } catch (x) { setErr(x.message); } setBusy(false); }
  return (<div className="ai-portal" data-testid="ai-admin">
    <div className="p-head"><div><h1>Manage AI clients</h1><p className="p-sub">Clients sign in at sleepysquid.com/login with a one-time email link (or Google) using their login email. Open a client&apos;s report to see admin-only errors and connection tests.</p></div></div>
    <section className="p-panel"><h2>Add a client</h2><form className="a-form a-form4" onSubmit={add}>
      <label>Client name<input className="p-input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Business name" data-testid="new-name" /></label>
      <label>Login email<input className="p-input" type="email" value={login} onChange={(e) => setLogin(e.target.value)} required placeholder="owner@business.com" data-testid="new-email" /></label>
      <label>Hourly rate ($/hr)<input className="p-input" type="number" min="1" max="1000" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={String(s.defaultRate)} data-testid="new-rate" /></label>
      <div className="p-dbtns"><button className="btn sm" disabled={busy} data-testid="add-client">{busy ? "Adding…" : "Add client"}</button></div>{err && <p className="p-err">{err}</p>}</form></section>
    <section className="p-panel"><div className="a-listhead"><h2>{deleted ? "Deleted clients" : "All clients"} ({s.clients.length})</h2><button type="button" className="a-link" onClick={() => setDeleted(!deleted)}>{deleted ? "Back to active clients" : "Show deleted"}</button></div>
      <div className="p-list">{s.clients.map((c) => <Row key={c.id + (c.deleted_at || "")} c={c} reload={load} />)}</div></section>
  </div>);
}
