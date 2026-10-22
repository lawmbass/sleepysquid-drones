import React from "react";
import { fmtMetric } from "./report";
import { plainTag, FOOTER, DEFINITIONS, headline, plural, DEFAULT_RATE, isRoutineKey, shortDate } from "./tags";
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Polyline, Circle, renderToBuffer } from "@react-pdf/renderer";
const h = React.createElement;
const C = { abyss: "#0a1f3a", blue: "#0c74bc", mint: "#34d399", green: "#0b6e4f", grey: "#7c8084", mist: "#eef5fb", ink: "#0d1b2a", deep: "#1c5090" };
const PAL = ["#0c74bc", "#34d399", "#1c5090", "#f5a524", "#5fb4ec", "#0b6e4f", "#7c8084"];
const s = StyleSheet.create({
  page: { padding: 34, paddingBottom: 62, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica" },
  band: { backgroundColor: C.abyss, color: "#fff", padding: 14, borderRadius: 8, marginBottom: 10 },
  brand: { color: C.mint, fontSize: 8.5, letterSpacing: 1, marginBottom: 3 }, h1: { fontSize: 17, fontFamily: "Helvetica-Bold" }, meta: { color: "#b7cde3", marginTop: 4, fontSize: 8.5 },
  ex: { backgroundColor: "#fff7e6", color: "#7a4b00", padding: 7, borderRadius: 6, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", gap: 6, marginBottom: 6 }, stat: { flex: 1, backgroundColor: C.mist, borderRadius: 6, padding: 8 },
  lab: { color: C.grey, fontSize: 7.5 }, big: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.abyss, marginTop: 2 }, sm: { fontSize: 6.5, color: C.grey },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 5, marginTop: 8, color: C.abyss },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.abyss, paddingBottom: 3, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#dde6ef", paddingVertical: 4 },
  src: { fontSize: 6.5, color: C.green }, est: { fontSize: 6.5, color: "#9a6700" }, act: { fontSize: 6.5, color: C.deep },
  foot: { position: "absolute", bottom: 12, left: 34, right: 34, fontSize: 7, color: C.grey },
  leg: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 3 }, card: { borderWidth: 0.5, borderColor: "#dde6ef", borderRadius: 6, padding: 8, marginBottom: 8 },
});
const tagStyle = (t) => (t.startsWith("SOURCED: bot") || t.startsWith("OUTCOME") ? s.src : t.startsWith("SOURCED") ? s.act : t.startsWith("CLIENT") ? { fontSize: 6.5, color: "#5b3aa8" } : s.est);
const Tag = (t) => h(Text, { style: tagStyle(t) }, plainTag(t).label);
const short = (m) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m.slice(5) - 1] + " " + m.slice(2, 4);
const W = 527;
function xLabels(months, w = W) { const bw = w / months.length, thin = bw < 28; return h(View, { style: { flexDirection: "row" } }, ...months.map((m, i) => h(Text, { key: m.m, style: { width: bw, fontSize: 6, color: C.grey, textAlign: "center" } }, thin && (months.length - 1 - i) % 3 ? "" : short(m.m) + (i === months.length - 1 ? "*" : "")))); }
const legend = (d) => h(View, { style: s.leg }, ...d.ids.map((id, i) => h(View, { key: id, style: { flexDirection: "row", alignItems: "center", gap: 3 } }, h(Svg, { width: 7, height: 7 }, h(Rect, { width: 7, height: 7, fill: PAL[i % 7] })), h(Text, { style: { fontSize: 7 } }, d.names[id]))));
function stacked(d, H = 95) {
  const max = Math.max(1, ...d.months.map((m) => m.total)), bw = W / d.months.length, els = [];
  d.months.forEach((m, i) => { let y = H; d.ids.forEach((id, j) => { const v = m.dollars[id] || 0, hh = (v / max) * H; if (hh > 0) { y -= hh; els.push(h(Rect, { key: `${i}-${j}`, x: i * bw + bw * 0.16, y, width: bw * 0.68, height: hh, fill: PAL[j % 7] })); } }); });
  return h(View, null, h(Svg, { width: W, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: W, y2: H, stroke: "#cfd8e3", strokeWidth: 1 }), ...els), xLabels(d.months), legend(d));
}
function weeklyStacked(d, H = 110) {
  const tot = d.weekly.map((x) => Object.values(x.dollars).reduce((t, v) => t + v, 0)), max = Math.max(1, ...tot), bw = W / Math.max(1, d.weekly.length), els = [];
  d.weekly.forEach((x, i) => { let y = H; d.ids.forEach((id, j) => { const v = x.dollars[id] || 0, hh = (v / max) * H; if (hh > 0) { y -= hh; els.push(h(Rect, { key: `${i}-${j}`, x: i * bw + bw * 0.2, y, width: bw * 0.6, height: hh, fill: PAL[j % 7] })); } }); });
  const lab = (w) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+w.slice(5, 7) - 1] + " " + +w.slice(8);
  return h(View, null, h(Svg, { width: W, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: W, y2: H, stroke: "#cfd8e3", strokeWidth: 1 }), ...els),
    h(View, { style: { flexDirection: "row" } }, ...d.weekly.map((x) => h(Text, { key: x.w, style: { width: bw, fontSize: 6.5, color: C.grey, textAlign: "center" } }, "Week of " + lab(x.w)))), legend(d));
}
function lines(d, H = 80) {
  const max = Math.max(1, ...d.months.flatMap((m) => d.ids.map((id) => m.units[id] || 0))), bw = W / d.months.length;
  return h(View, null, h(Svg, { width: W, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: W, y2: H, stroke: "#cfd8e3", strokeWidth: 1 }),
    ...d.ids.map((id, j) => h(Polyline, { key: id, points: d.months.map((m, i) => `${i * bw + bw / 2},${H - ((m.units[id] || 0) / max) * H}`).join(" "), stroke: PAL[j % 7], strokeWidth: 1.6, fill: "none" }))), xLabels(d.months), h(Text, { style: s.sm }, `Peak ${Math.round(max)} units/month`), legend(d));
}
function spark(m, w = 160, H = 34) {
  const vals = m.monthly.map((x) => x.v), max = Math.max(1e-9, ...vals.filter((v) => v != null)), bw = w / vals.length;
  const pts = vals.map((v, i) => (v == null ? null : `${i * bw + bw / 2},${H - (v / max) * H}`)).filter(Boolean);
  const col = m.kind === "outcome" ? "#f5a524" : m.kind === "duration_avg" ? C.deep : C.blue;
  return h(Svg, { width: w, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: w, y2: H, stroke: "#cfd8e3", strokeWidth: 0.7 }), pts.length > 1 ? h(Polyline, { points: pts.join(" "), stroke: col, strokeWidth: 1.4, fill: "none" }) : null);
}
function metricGrid(d) {
  const pc = (v) => (v == null ? "n/a" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`); const dm = d.dataMonths;
  return h(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 6 } }, ...d.metrics.filter((m) => m.range > 0 && !isRoutineKey(m.key)).map((m) => h(View, { key: m.key, style: { width: 168, borderWidth: 0.5, borderColor: "#dde6ef", borderRadius: 5, padding: 5 }, wrap: false },
    h(Text, { style: { fontSize: 7.5, fontFamily: "Helvetica-Bold" } }, m.label),
    h(Text, { style: { fontSize: 7, marginVertical: 2 } }, `Range ${fmtMetric(m, m.range)}${dm >= 2 ? ` · MoM ${pc(m.mom)}` : ""}${dm >= 12 ? ` · YoY ${pc(m.yoy)}` : ""}`), spark(m),
    h(Text, { style: { fontSize: 5.5, color: C.grey } }, `${short(m.monthly[0].m)} to ${short(m.monthly[m.monthly.length - 1].m)}${m.kind === "duration_avg" ? " · avg, lower is better" : ""}`))));
}
function seasonalChart(d, money, H = 80) {
  const MON = ["J","F","M","A","M","J","J","A","S","O","N","D"], bw = W / 12, all = d.seasonal.flatMap((x) => d.seasonalYears.map((y) => x[y])).filter((v) => v != null), max = Math.max(1, ...all);
  const cols = ["#b7cde3", C.mint];
  return h(View, null, h(Svg, { width: W, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: W, y2: H, stroke: "#cfd8e3", strokeWidth: 1 }),
    ...d.seasonalYears.map((y, j) => { const pts = d.seasonal.map((x, i) => (x[y] == null ? null : `${i * bw + bw / 2},${H - (x[y] / max) * H}`)).filter(Boolean); return pts.length > 1 ? h(Polyline, { key: y, points: pts.join(" "), stroke: cols[j], strokeWidth: 2, fill: "none" }) : null; })),
    h(View, { style: { flexDirection: "row" } }, ...MON.map((m, i) => h(Text, { key: i, style: { width: bw, fontSize: 6.5, color: C.grey, textAlign: "center" } }, m))),
    h(Text, { style: s.sm }, `Grey ${d.seasonalYears[0]}, green ${d.seasonalYears[1]}. Peak month ${money(max)}.`));
}
function yoyBars(d, money, w = 255) {
  const rows = d.yoy.per, max = Math.max(1, ...rows.flatMap((r) => [r.cur, r.ly])), lw = 92, bw = w - lw - 40;
  return h(View, null, ...rows.map((r) => h(View, { key: r.id, style: { flexDirection: "row", alignItems: "center", marginBottom: 3 } },
    h(Text, { style: { width: lw, fontSize: 7 } }, r.name),
    h(View, null, h(Svg, { width: bw, height: 13 }, h(Rect, { x: 0, y: 0, width: Math.max(0.5, (r.ly / max) * bw), height: 5.5, fill: "#b7cde3" }), h(Rect, { x: 0, y: 7, width: Math.max(0.5, (r.cur / max) * bw), height: 5.5, fill: C.mint }))),
    h(Text, { style: { width: 40, fontSize: 6.5, textAlign: "right" } }, r.has ? money(r.cur) : `${money(r.cur)}*`))),
    h(Text, { style: s.sm }, `Grey ${short(d.lyMonth)}, green ${short(d.curMonth)} (days 1-${d.dom}). * not live a year ago.`));
}
function rolling(d, money, w = 255, H = 90) {
  const pts = d.months.map((m, i) => ({ i, v: m.rolling12Full ? m.rolling12 : null })), vals = pts.filter((p) => p.v != null), max = Math.max(1, ...vals.map((p) => p.v)), bw = w / d.months.length;
  return h(View, null, h(Svg, { width: w, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: w, y2: H, stroke: "#cfd8e3", strokeWidth: 1 }),
    vals.length > 1 ? h(Polyline, { points: vals.map((p) => `${p.i * bw + bw / 2},${H - (p.v / max) * H}`).join(" "), stroke: C.blue, strokeWidth: 2, fill: "none" }) : null,
    ...vals.map((p) => h(Circle, { key: p.i, cx: p.i * bw + bw / 2, cy: H - (p.v / max) * H, r: 2, fill: C.blue }))), xLabels(d.months, w),
    h(Text, { style: s.sm }, vals.length ? `Latest ${money(vals[vals.length - 1].v)}; shown once 12 months of history exist.` : "Needs 12 months of history."));
}
function impl(d, H = 45) {
  const max = Math.max(1, ...d.months.map((m) => m.implemented)), bw = W / d.months.length;
  return h(View, null, h(Svg, { width: W, height: H + 1 }, h(Line, { x1: 0, y1: H, x2: W, y2: H, stroke: "#cfd8e3", strokeWidth: 1 }),
    ...d.months.map((m, i) => h(Rect, { key: i, x: i * bw + bw * 0.2, width: bw * 0.6, y: H - (m.implemented / max) * H, height: Math.max(0.01, (m.implemented / max) * H), fill: C.deep }))),
    h(View, { style: { flexDirection: "row" } }, ...d.months.map((m) => h(Text, { key: m.m, style: { width: bw, fontSize: 6, color: C.abyss, textAlign: "center", fontFamily: "Helvetica-Bold" } }, String(m.implemented)))), xLabels(d.months));
}
export async function renderReportPdf(r) {
  const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: r.client.currency, maximumFractionDigits: 0 }).format(v);
  const m2 = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: r.client.currency }).format(v);
  const header = h(View, { fixed: true }, h(View, { style: s.band }, h(Text, { style: s.brand }, "SLEEPYSQUID AI · MONTHLY VALUE REPORT"), h(Text, { style: s.h1 }, r.client.name),
      h(Text, { style: s.meta }, `${r.from} to ${r.to}`)),
    r.client.is_example ? h(Text, { style: s.ex }, "EXAMPLE DATA: demo client with sample numbers, not a real business.") : null);
  const foot = h(Text, { style: s.foot, fixed: true, render: ({ pageNumber, totalPages }) => `${FOOTER}\nGenerated ${r.generated.slice(0, 10)} · SleepySquid AI · support@sleepysquid.com · Page ${pageNumber} of ${totalPages}` });
  const stat = (lab, val, tag, sub) => h(View, { style: s.stat }, h(Text, { style: s.lab }, lab), h(Text, { style: s.big }, val), sub ? h(Text, { style: s.sm }, sub) : null, tag ? Tag(tag) : null);
  const days = (Date.parse(r.to) - Date.parse(r.from)) / 86400000 + 1;
  const ratio = r.planPrice ? r.totals.dollars / (r.planPrice * days / 30.44) : null;
  const speed = r.metrics.find((m) => m.kind === "duration_avg" && m.range != null);
  const counted = r.metrics.filter((m) => m.headline && m.kind === "count"), results = r.metrics.filter((m) => m.kind === "outcome");
  const hl = headline(r, money);
  const legendRow = h(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 } }, ...[["SOURCED: bot", "Counted by your automations"], ["SOURCED: BLS", "DC-MD-VA hourly wage, U.S. BLS"], ["ESTIMATE", "times ran × minutes by hand × wage"], ["CLIENT", "a number you gave us"]].map(([k, d]) => h(Text, { key: k, style: { fontSize: 7 } }, h(Text, { style: tagStyle(k) }, plainTag(k).label), `: ${d}`)));
  const collecting = !(r.totals.dollars > 0);
  const summary = r.weekSummary?.length ? `This week your automations ${r.weekSummary.join(" and ")}.` : null;
  const tz = r.client.timezone;
  const page1 = r.workflows.length ? [
      summary ? h(Text, { style: { fontSize: 11, marginBottom: 4, color: C.abyss } }, summary) : null,
      hl ? h(Text, { style: { fontSize: 9, marginBottom: 4, color: C.ink } }, hl) : null,
      r.lastUpdated ? h(Text, { style: [s.sm, { marginBottom: 6 }] }, `Last updated ${new Date(r.lastUpdated).toLocaleString("en-US", { timeZone: tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}${r.rateIsDefault ? ` · Default rate ($${DEFAULT_RATE}/hr), change in Settings` : ""}`) : null,
      // error items are admin-only and never appear in the client PDF
      h(Text, { style: [s.h2, { marginTop: 2 }] }, "Estimates"),
      h(View, { style: s.row }, ...(collecting ? [stat("Est. value saved", "Collecting data", null, r.firstNumbersBy ? `First numbers by ${shortDate(r.firstNumbersBy, tz)}` : null)] : [stat("Est. value saved", money(r.totals.dollars), null, ratio != null ? `${ratio.toFixed(1)}x your plan (${money(r.planPrice)}/mo)` : null), stat("Est. hours saved", r.totals.hours.toFixed(1), null)])),
      h(Text, { style: [s.h2, { marginTop: 2 }] }, "Counted"), !r.headlineTiles.length ? h(Text, { style: [s.sm, { marginBottom: 6 }] }, `Collecting data, first numbers by ${shortDate(r.firstNumbersBy, tz)}.`) : h(View, { style: [s.row, { flexWrap: "wrap" }] }, ...r.headlineTiles.map((t) => h(View, { key: t.key, style: [s.stat, { minWidth: 120 }] }, h(Text, { style: s.lab }, t.label), h(Text, { style: s.big }, Math.round(t.value).toLocaleString())))),
      r.recontacted != null ? h(Text, { style: [s.sm, { marginBottom: 4 }] }, `Leads re-contacted: ${Math.round(r.recontacted).toLocaleString()}`) : null,
      h(View, { style: s.row }, stat("Automations", `${plural(r.reportingCount, "automation")} reporting`, null)),
    ] : [h(Text, { key: "e", style: { marginTop: 10 } }, r.lastUpdated ? `Nothing ran between ${r.from} and ${r.to}. Try a wider range.` : `Collecting data, first numbers by ${shortDate(r.firstNumbersBy, tz)}.`)];
  const how = [h(Text, { style: [s.h2, { marginTop: 0 }] }, "How we calculate"),
      h(Text, { style: { marginBottom: 6 } }, "For each task, we multiply how many times it ran by the minutes it typically takes by hand, then convert to hours at the hourly wage below. Results (like deals closed) and reply speed are counted but never turned into dollars."),
      h(View, { style: s.th }, h(Text, { style: { flex: 2.2 } }, "Task (applies to)"), h(Text, { style: { flex: 1.3 } }, "Minutes by hand"), h(Text, { style: { flex: 1.8 } }, "Hourly wage"), h(Text, { style: { flex: 1.2, textAlign: "right" } }, "Value each time")),
      ...r.rates.map((x) => h(View, { key: x.id, style: s.tr, wrap: false }, h(View, { style: { flex: 2.2 } }, h(Text, null, x.name), h(Text, { style: s.sm }, (x.metrics || []).join(", "))),
        h(View, { style: { flex: 1.3 } }, h(Text, null, String(x.minutes)), Tag(x.minutesTag)), h(View, { style: { flex: 1.8 } }, h(Text, null, `${m2(x.wage)}/h`), Tag(x.wageTag)),
        h(View, { style: { flex: 1.2, alignItems: "flex-end" } }, h(Text, null, m2(x.unitValue)), Tag(x.tag)))),
      ...(r.legacyTimings || []).map((t, i) => h(View, { key: "l" + i, style: s.tr, wrap: false }, h(View, { style: { flex: 2.2 } }, h(Text, null, t.label), h(Text, { style: s.sm }, t.automation)),
        h(Text, { style: { flex: 1.3 } }, String(t.minutes)), h(Text, { style: { flex: 1.8 } }, `${m2(Number(r.client.hourly_rate))}/h${r.rateIsDefault ? " (default)" : ""}`), h(Text, { style: { flex: 1.2, textAlign: "right" } }, m2(t.minutes / 60 * r.client.hourly_rate)))), legendRow];
  const charts = r.weekly.length ? [h(View, { style: s.card, wrap: false }, h(Text, { style: [s.h2, { marginTop: 0 }] }, "Est. value saved per week, by automation"), weeklyStacked(r))] : [];
  const doc = h(Document, { title: `${r.client.name} Monthly Value Report ${r.from} to ${r.to}`, author: "SleepySquid AI" },
    h(Page, { size: "LETTER", style: s.page }, header, ...page1, foot),
    h(Page, { size: "LETTER", style: s.page }, header, ...how, foot),
    charts.length ? h(Page, { size: "LETTER", style: s.page }, header, ...charts, foot) : null);
  return renderToBuffer(doc);
}
