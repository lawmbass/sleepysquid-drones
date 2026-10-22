import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { compact } from "@/libs/aiPortal/chartRange";
import { isTrendMetric } from "@/libs/aiPortal/tags";
export const PALETTE = ["#0c74bc", "#34d399", "#1c5090", "#f5a524", "#5fb4ec", "#0b6e4f", "#7c8084"];
const ax = { fontSize: 12, fill: "#7c8084" };
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const short = (m) => MON[+m.slice(5) - 1] + " " + m.slice(2, 4);
const tipStyle = { borderRadius: 10, fontSize: 13 };
const pct = (v) => (v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`);
const usd = (v) => "$" + compact(v);
const PER = { day: "day", week: "week", month: "month" };
// Y axis: wide enough for compact labels like "$1.2k" / "12.5k" at 360px; no negative left margin (that clipped labels).
const yAx = (fmt, ints) => ({ tick: ax, width: 46, tickFormatter: fmt, allowDecimals: !ints });
const M = { top: 6, left: 0, right: 8, bottom: 0 };

function MetricCard({ m, d }) {
  const isAvg = m.kind === "duration_avg";
  const data = m.series.map((x) => ({ b: x.label, v: x.v == null ? null : Math.round(x.v * 10) / 10 }));
  const color = m.kind === "outcome" ? "#f5a524" : isAvg ? "#1c5090" : "#0c74bc";
  return (<div className="p-mcard" data-testid="trend" data-metric={m.key}>
    <div className="p-mhead"><b>{m.label}</b></div>
    <div className="p-mnums">{d.dataMonths >= 2 && <span>MoM <b>{pct(m.mom)}</b></span>}{d.dataMonths >= 12 && <span>YoY <b>{pct(m.yoy)}</b></span>}{isAvg && <span className="p-sub sm">avg, lower is better</span>}</div>
    <ResponsiveContainer width="100%" height={120}><LineChart data={data} margin={M}>
      <CartesianGrid stroke="#eef2f6" vertical={false} /><XAxis dataKey="b" tick={{ fontSize: 10, fill: "#7c8084" }} interval="preserveStartEnd" minTickGap={16} /><YAxis {...yAx(compact, !isAvg)} tick={{ fontSize: 10, fill: "#7c8084" }} />
      <Tooltip contentStyle={tipStyle} formatter={(v) => [isAvg ? `${v} min` : v.toLocaleString(), m.label]} /><Line dataKey="v" stroke={color} strokeWidth={2.5} dot={data.length <= 31 ? { r: 2 } : false} connectNulls={false} /></LineChart></ResponsiveContainer>
  </div>);
}

export function Charts({ d, money }) {
  const s = d.series, per = PER[s.size];
  const val = s.buckets.map((x) => ({ b: x.label, ...Object.fromEntries(d.ids.map((id) => [id, Math.round(x.dollars[id] || 0)])) }));
  const live = s.buckets.map((x) => ({ b: x.label, v: x.live }));
  const r12 = d.months.map((x) => ({ m: short(x.m), v: x.rolling12Full ? Math.round(x.rolling12) : null }));
  const yoy = d.yoy.per.map((p) => ({ name: p.name, [short(d.lyMonth)]: Math.round(p.ly), [short(d.curMonth)]: Math.round(p.cur) }));
  const seas = d.seasonal.map((x) => ({ mon: MON[x.mon - 1], ...Object.fromEntries(d.seasonalYears.map((y) => [y, x[y] == null ? null : Math.round(x[y])])) }));
  const legend = { formatter: (k) => d.names[k] || k, wrapperStyle: { fontSize: 12 } };
  const trends = d.metrics.filter((m) => isTrendMetric(m) && m.hasRangeData);
  const H = 260, rangeNote = <p className="p-sub sm" data-testid="range-note">{d.from} to {d.to}, by {per}.</p>;
  return (<>
    <section className="p-panel" data-testid="value-chart" data-domain={`${s.size}:${s.buckets[0]?.b}:${s.buckets[s.buckets.length - 1]?.b}:${s.buckets.length}`}><h2>Est. value saved per {per}, by automation</h2>{rangeNote}
      <ResponsiveContainer width="100%" height={H}><BarChart data={val} margin={M}><CartesianGrid stroke="#e5edf5" vertical={false} /><XAxis dataKey="b" tick={ax} minTickGap={18} /><YAxis {...yAx(usd, true)} />
        <Tooltip contentStyle={tipStyle} formatter={(v, k) => [money(v), d.names[k] || k]} /><Legend {...legend} />{d.ids.map((id, i) => <Bar key={id} dataKey={id} stackId="a" fill={PALETTE[i % 7]} />)}</BarChart></ResponsiveContainer></section>
    {trends.length > 0 && <section className="p-panel" data-testid="trends"><h2>Trends by metric</h2>{rangeNote}<p className="p-sub sm">{d.dataMonths < 2 ? "Month-over-month changes show after 2 full months of data. " : ""}MoM and YoY compare days 1-{d.dom} of {d.curMonth} with the same days of {d.prevMonth} and {d.lyMonth}.</p>
      <div className="p-mgrid">{trends.map((m) => <MetricCard key={m.key} m={m} d={d} />)}</div></section>}
    <section className="p-panel" data-testid="live-chart"><h2>Automations live over time</h2>{rangeNote}
      <ResponsiveContainer width="100%" height={200}><BarChart data={live} margin={M}><CartesianGrid stroke="#e5edf5" vertical={false} /><XAxis dataKey="b" tick={ax} minTickGap={14} /><YAxis {...yAx(compact, true)} /><Tooltip contentStyle={tipStyle} /><Bar dataKey="v" name="Live automations" fill="#1c5090" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></section>
    {d.businessType === "landscaper" && <section className="p-panel"><h2>Seasonal view: value saved by calendar month</h2><p className="p-sub sm">All history, not the selected range. Each line is one year, so busy and slow seasons line up.</p>
      <ResponsiveContainer width="100%" height={H}><LineChart data={seas} margin={M}><CartesianGrid stroke="#e5edf5" vertical={false} /><XAxis dataKey="mon" tick={ax} /><YAxis {...yAx(usd, true)} />
        <Tooltip contentStyle={tipStyle} formatter={(v) => money(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />{d.seasonalYears.map((y, i) => <Line key={y} dataKey={String(y)} stroke={i ? "#34d399" : "#b7cde3"} strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />)}</LineChart></ResponsiveContainer></section>}
    {d.dataMonths >= 12 && <div className="p-two">
      <section className="p-panel"><h2>Year over year</h2><p className="p-sub sm">All history, not the selected range: {short(d.curMonth)} vs {short(d.lyMonth)}, days 1-{d.dom}.</p>
        <ResponsiveContainer width="100%" height={H}><BarChart data={yoy} layout="vertical" margin={{ left: 10, right: 10 }}><CartesianGrid stroke="#e5edf5" horizontal={false} /><XAxis type="number" tick={ax} tickFormatter={usd} /><YAxis type="category" dataKey="name" tick={ax} width={110} />
          <Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey={short(d.lyMonth)} fill="#b7cde3" /><Bar dataKey={short(d.curMonth)} fill="#34d399" /></BarChart></ResponsiveContainer></section>
      <section className="p-panel"><h2>Rolling 12-month value</h2><p className="p-sub sm">All history, not the selected range: trailing 12 months, shown once 12 months of history exist.</p>
        <ResponsiveContainer width="100%" height={H}><LineChart data={r12} margin={M}><CartesianGrid stroke="#e5edf5" vertical={false} /><XAxis dataKey="m" tick={ax} minTickGap={14} /><YAxis {...yAx(usd, true)} />
          <Tooltip formatter={(v) => money(v)} contentStyle={tipStyle} /><Line dataKey="v" name="Rolling 12M" stroke="#0c74bc" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} /></LineChart></ResponsiveContainer></section>
    </div>}
  </>);
}
