// Shared analytics for dashboard + PDF.
// Valuation per count key: catalog (client's business type) savable metric -> rates layer workflow (client override wins);
// else automation.workflow_type unit metric; else legacy per-automation minutes x client hourly rate.
// duration_avg metrics are averaged, outcome metrics are summed; neither is $-valued. Unknown keys are kept as plain counts.
import { bucketSize, bucketOf, bucketKeys, bucketLabel, bucketEnd } from "./chartRange";
import { db } from "./db";
import { issueId, loadResolutions } from "./issues";
import { FRIENDLY, TILE_GROUPS, DEFAULT_RATE, SHOW_ACTIVITY_TILES, KEEP_TILE_KEYS, isCountedTile, isRoutineKey, isErrorNote, classifyIssue, isInternalAutomation, isTestCounts } from "./tags";

async function dbAll(path) {
  const out = [];
  for (let off = 0; ; off += 1000) { const rows = await db(`${path}&limit=1000&offset=${off}`); out.push(...rows); if (rows.length < 1000) return out; }
}
const ym = (d) => d.toISOString().slice(0, 7);
const enc = encodeURIComponent;
const pretty = (k) => FRIENDLY[k] || k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const isDur = (k) => /_minutes$/.test(k);

export function resolveRate(wt, defaults, overrides) {
  const d = defaults[wt]; if (!d) return null;
  const o = overrides[wt] || {};
  const minutes = o.minutes_per_unit != null ? Number(o.minutes_per_unit) : Number(d.minutes_per_unit);
  const wage = o.hourly_wage != null ? Number(o.hourly_wage) : Number(d.hourly_wage);
  const minutesTag = o.minutes_per_unit != null ? o.source || "CLIENT ACTUAL" : d.minutes_source || "ESTIMATE";
  const wageTag = o.hourly_wage != null ? o.source || "CLIENT ACTUAL" : d.wage_source;
  return { id: wt, name: d.name, minutes, wage, unitValue: (minutes / 60) * wage, minutesTag, wageTag,
    tag: minutesTag.startsWith("CLIENT") && wageTag.startsWith("CLIENT") ? "CLIENT ACTUAL" : "ESTIMATE" };
}

export async function buildReport(clientId, from, to) {
  const [client] = await db(`portal_clients?id=eq.${enc(clientId)}&select=*`);
  // select=* so this works before and after the optional `internal` column migration
  const allAutomations = await db(`portal_automations?client_id=eq.${enc(clientId)}&select=*&order=automation_id`);
  const hiddenIds = new Set(allAutomations.filter(isInternalAutomation).map((a) => a.automation_id));
  const automations = allAutomations.filter((a) => !hiddenIds.has(a.automation_id));
  const defaults = Object.fromEntries((await db("portal_rate_defaults?select=*")).map((d) => [d.workflow_type, d]));
  const overrides = Object.fromEntries((await db(`portal_rate_overrides?client_id=eq.${enc(clientId)}&select=*`)).map((o) => [o.workflow_type, o]));
  const catRows = await db(`portal_metric_catalog?business_type=eq.${enc(client.business_type)}&select=*&order=sort`);
  const labelOv = Object.fromEntries((await db(`portal_metric_label_overrides?client_id=eq.${enc(clientId)}&select=metric_key,label`)).map((l) => [l.metric_key, l.label]));
  const catalog = Object.fromEntries(catRows.map((c) => [c.metric_key, { ...c, label: labelOv[c.metric_key] || (c.metric_key === "missed_followups_recovered" ? "Leads re-contacted" : c.label) }]));
  const rateCache = {}; const rate = (wt) => (wt in rateCache ? rateCache[wt] : (rateCache[wt] = resolveRate(wt, defaults, overrides)));
  const autoById = Object.fromEntries(automations.map((a) => [a.automation_id, a]));

  // returns {minutes, dollars, rates:Set, legacy:boolean}
  function valueOf(rep) {
    const a = autoById[rep.automation_id] || {}; let minutes = 0, dollars = 0, legacy = false; const used = new Set();
    for (const [k, n0] of Object.entries(rep.counts || {})) {
      const n = Number(n0), c = catalog[k];
      let wt = null;
      if (c) { if (c.kind !== "count" || !c.savable) continue; wt = c.workflow_type; }
      else if (a.workflow_type && defaults[a.workflow_type]?.unit_metric === k) wt = a.workflow_type;
      const r = wt && rate(wt);
      if (r) { const per = rep.minutes_per_unit?.[k] != null ? Number(rep.minutes_per_unit[k]) : r.minutes; minutes += n * per; dollars += (n * per / 60) * r.wage; used.add(wt); }
      else if (!c && !isDur(k)) { const per = rep.minutes_per_unit?.[k] ?? a.default_minutes_per_unit?.[k]; if (per != null) { minutes += n * Number(per); dollars += (n * Number(per) / 60) * Number(client.hourly_rate); legacy = true; } }
    }
    const x = Number(rep.extra_minutes_saved || 0); if (x) { minutes += x; dollars += (x / 60) * Number(client.hourly_rate); legacy = true; }
    return { minutes, dollars, used, legacy };
  }

  const toD = new Date(to + "T00:00:00Z"), end = new Date(toD.getTime() + 86400000), endIso = end.toISOString();
  const N = 15;
  const histStart = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth() - (N - 1), 1));
  const start = new Date(Math.min(Date.UTC(toD.getUTCFullYear() - 2, 0, 1), Date.parse(from + "T00:00:00Z")));
  const hiddenNames = Object.fromEntries(allAutomations.filter((a) => hiddenIds.has(a.automation_id)).map((a) => [a.automation_id, { id: a.automation_id, name: a.name, reports: 0 }]));
  const reports = (await dbAll(`portal_reports?client_id=eq.${enc(clientId)}&period_start=gte.${start.toISOString()}&period_start=lt.${endIso}&select=report_id,automation_id,automation_name,period_start,period_end,emitted_at,counts,minutes_per_unit,extra_minutes_saved,errors,notes&order=period_start.asc`)).filter((r) => {
    const hide = hiddenIds.has(r.automation_id) || isInternalAutomation(r) || isTestCounts(r.counts);
    if (hide && !hiddenNames[r.automation_id]) hiddenNames[r.automation_id] = { id: r.automation_id, name: r.automation_name, reports: 0 };
    if (hide) hiddenNames[r.automation_id].reports++;
    return !hide;
  });

  const names = Object.fromEntries(automations.map((a) => [a.automation_id, a.name]));
  const ids = automations.map((a) => a.automation_id);
  for (const r of reports) if (!names[r.automation_id]) { names[r.automation_id] = r.automation_name; ids.push(r.automation_id); }

  const dom = toD.getUTCDate(), curM = ym(toD), lyM = ym(new Date(Date.UTC(toD.getUTCFullYear() - 1, toD.getUTCMonth(), 1)));
  const prevM = ym(new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth() - 1, 1)));
  const byMonth = {}, firstSeen = {}, per = {}, yoyW = Object.fromEntries(ids.map((id) => [id, { cur: 0, ly: 0, has: false }]));
  const mAgg = {}; // metric -> month -> {sum, n} ; plus range + mtd buckets
  const bucket = (k, b) => { const m = (mAgg[k] ||= {}); return (m[b] ||= { sum: 0, n: 0 }); };
  const usedRates = new Set(); let usedLegacy = false; let prevMtd = 0, curMtd = 0;
  for (const r of reports) {
    const v = valueOf(r), m = r.period_start.slice(0, 7), id = r.automation_id, day = Number(r.period_start.slice(8, 10));
    const inRange = r.period_start >= from && r.period_start < endIso;
    firstSeen[id] = firstSeen[id] && firstSeen[id] < m ? firstSeen[id] : m;
    const bm = (byMonth[m] ||= { dollars: {}, minutes: 0 }); bm.dollars[id] = (bm.dollars[id] || 0) + v.dollars; bm.minutes += v.minutes;
    if (day <= dom) { if (m === curM) { yoyW[id].cur += v.dollars; curMtd += v.dollars; } if (m === lyM) { yoyW[id].ly += v.dollars; yoyW[id].has = true; } if (m === prevM) prevMtd += v.dollars; }
    for (const [k, n] of Object.entries(r.counts || {})) {
      const b1 = bucket(k, m); b1.sum += Number(n); b1.n++;
      if (inRange) { const b2 = bucket(k, "range"); b2.sum += Number(n); b2.n++; }
      if (day <= dom && (m === curM || m === lyM || m === prevM)) { const b3 = bucket(k, "mtd:" + m); b3.sum += Number(n); b3.n++; }
    }
    if (inRange) {
      v.used.forEach((x) => usedRates.add(x)); usedLegacy ||= v.legacy;
      const p = (per[id] ||= { id, name: names[id], minutes: 0, dollars: 0, runs: 0, errors: 0, counts: {}, rates: new Set(), legacy: false });
      p.minutes += v.minutes; p.dollars += v.dollars; p.runs++; p.errors += r.errors; v.used.forEach((x) => p.rates.add(x)); p.legacy ||= v.legacy;
      for (const [k, n] of Object.entries(r.counts)) p.counts[k] = (p.counts[k] || 0) + n;
    }
  }
  const tagOf = (set, legacy) => (!legacy && set.size && [...set].every((wt) => rate(wt).tag === "CLIENT ACTUAL") ? "CLIENT ACTUAL" : "ESTIMATE");
  const monthKeys = (a, n) => Array.from({ length: n }, (_, i) => ym(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + i, 1))));
  const sumM = (m) => Object.values(byMonth[m]?.dollars || {}).reduce((t, x) => t + x, 0);
  const allKeys = monthKeys(start, (toD.getUTCFullYear() - start.getUTCFullYear()) * 12 + toD.getUTCMonth() - start.getUTCMonth() + 1);
  const firstAny = Object.values(firstSeen).sort()[0];
  const months = monthKeys(histStart, N).map((m) => {
    const i = allKeys.indexOf(m), last12 = allKeys.slice(Math.max(0, i - 11), i + 1);
    return { m, total: sumM(m), hours: (byMonth[m]?.minutes || 0) / 60, dollars: byMonth[m]?.dollars || {},
      rolling12: last12.reduce((t, k) => t + sumM(k), 0), rolling12Full: !!firstAny && firstAny <= allKeys[i - 11],
      implemented: Object.values(firstSeen).filter((f) => f <= m).length };
  });
  const agg = (k, b) => { const x = mAgg[k]?.[b]; if (!x || !x.n) return null; return (catalog[k]?.kind === "duration_avg" || (!catalog[k] && isDur(k))) ? x.sum / x.n : x.sum; };
  const pct = (a, b) => (a != null && b != null && b > 0 ? ((a - b) / b) * 100 : null);
  const keys = [...catRows.map((c) => c.metric_key), ...Object.keys(mAgg).filter((k) => !catalog[k]).sort()];
  const metrics = keys.map((k) => {
    const c = catalog[k] || { label: pretty(k), kind: isDur(k) ? "duration_avg" : "count", headline: false, savable: false, workflow_type: null, catalogued: false };
    const r = c.savable ? rate(c.workflow_type) : null;
    const cur = agg(k, "mtd:" + curM), ly = agg(k, "mtd:" + lyM), prev = agg(k, "mtd:" + prevM);
    return { key: k, label: c.label, kind: c.kind, headline: !!c.headline, savable: !!c.savable, catalogued: c.catalogued !== false, rate: r,
      tag: c.kind === "outcome" ? "OUTCOME (not $-valued)" : c.kind === "duration_avg" ? "SOURCED: bot reports (average)" : "SOURCED: bot reports",
      range: agg(k, "range"), monthly: months.map((mo) => ({ m: mo.m, v: agg(k, mo.m) })), cur, ly, prev, yoy: pct(cur, ly), mom: pct(cur, prev),
      // duration: lower is better
      better: c.kind === "duration_avg" ? "lower" : "higher" };
  }).filter((x) => x.monthly.some((y) => y.v != null) || x.range != null); // never-reported metrics are hidden
  // seasonal: $ by calendar month, one series per year (landscaper view)
  const yrs = [toD.getUTCFullYear() - 1, toD.getUTCFullYear()];
  const seasonal = Array.from({ length: 12 }, (_, i) => ({ mon: i + 1, ...Object.fromEntries(yrs.map((y) => { const k = `${y}-${String(i + 1).padStart(2, "0")}`; return [y, byMonth[k] && k <= curM ? sumM(k) : null]; })) }));

  // weekly stacked $ by automation over the selected range (weeks start Monday)
  const wkStart = (iso) => { const d = new Date(iso.slice(0, 10) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const weeks = {}; const inR = reports.filter((r) => r.period_start >= from && r.period_start < endIso);
  for (const r of inR) { const w = wkStart(r.period_start); const o = (weeks[w] ||= { w, dollars: {} }); o.dollars[r.automation_id] = (o.dollars[r.automation_id] || 0) + valueOf(r).dollars; }
  const weekly = Object.values(weeks).sort((a, b) => (a.w < b.w ? -1 : 1));
  const savableCount = (r) => Object.entries(r.counts || {}).filter(([k, n]) => n > 0 && catalog[k]?.kind !== "duration_avg" && !isDur(k) && !isRoutineKey(k)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${Number(n).toLocaleString()} ${(catalog[k]?.label || pretty(k)).toLowerCase()}`);
  const recentWins = [...inR].sort((a, b) => (a.period_start < b.period_start ? 1 : -1)).filter((r) => valueOf(r).dollars > 0).slice(0, 5).map((r) => ({ at: r.period_start, name: names[r.automation_id], what: savableCount(r).join(", "), note: isErrorNote(r.notes) || /^\[(error|note)\]/i.test(r.notes || "") ? null : wonNote(r.notes), dollars: valueOf(r).dollars }));
  const issues = [...inR].sort((a, b) => (a.period_start < b.period_start ? 1 : -1)).map((r) => ({ r, c: (r.errors > 0 || /^\[(error|note)\]/i.test(r.notes || "")) ? classifyIssue(r.notes, r.errors) : null })).filter((x) => x.c);
  const res = await loadResolutions(clientId);
  const issueItem = ({ r, c }) => { const id = issueId(r.report_id, r.notes), z = res.byId[id];
    return { id, reportId: r.report_id, kind: c.kind, at: r.period_start, name: names[r.automation_id], errors: r.errors || 0, note: c.reason, fix: c.fix, noDetails: !!c.noDetails,
      resolved: z?.status === "resolved", resolvedBy: z?.status === "resolved" ? z.resolved_by : null, resolvedAt: z?.status === "resolved" ? z.resolved_at : null, resolvedAction: z?.status === "resolved" ? z.action : null }; };
  const allIssues = issues.map(issueItem), open = allIssues.filter((x) => !x.resolved);
  const attention = open.filter((x) => x.kind === "attention").slice(0, 20);
  const issueNotes = open.filter((x) => x.kind === "note").slice(0, 20);
  const resolvedIssues = allIssues.filter((x) => x.resolved).sort((a, b) => (a.resolvedAt < b.resolvedAt ? 1 : -1)).slice(0, 50);
  const resolutionsAvailable = res.available;
  const lastUpdated = reports.length ? reports.reduce((m, r) => (r.emitted_at > m ? r.emitted_at : m), "") : null;
  const dataMonths = firstAny ? allKeys.filter((k) => k >= firstAny && k < curM).length : 0; // full months with data
  const workflows = Object.values(per).map((p) => ({ ...p, rates: [...p.rates], hours: p.minutes / 60, tag: tagOf(p.rates, p.legacy) })).sort((a, b) => b.dollars - a.dollars);
  const totals = { hours: workflows.reduce((t, w) => t + w.hours, 0), dollars: workflows.reduce((t, w) => t + w.dollars, 0), runs: workflows.reduce((t, w) => t + w.runs, 0) };
  // ---- dashboard v2: tiles that map to what this client actually reports ----
  const sumKeys = (keys, rows) => { let v = 0, seen = false; for (const r of rows) for (const k of keys) if (r.counts?.[k] != null) { seen = true; v += Number(r.counts[k]); } return seen ? v : null; };
  const lastMs = lastUpdated ? Date.parse(lastUpdated) : 0;
  const weekRows = reports.filter((r) => Date.parse(r.period_start) > lastMs - 7 * 86400000);
  const reportedKeys = new Set(inR.flatMap((r) => Object.keys(r.counts || {})));
  const grouped = new Set();
  const tiles = [];
  for (const g of TILE_GROUPS) { const ks = g.keys.filter((k) => reportedKeys.has(k)); if (!ks.length) continue; ks.forEach((k) => grouped.add(k)); tiles.push({ key: g.id, label: g.label, verb: g.verb, noun: g.noun, value: sumKeys(ks, inR), week: sumKeys(ks, weekRows) }); }
  for (const m of metrics) { // catalog/standard + other reported counts
    if (grouped.has(m.key) || m.kind !== "count" || m.range == null || isRoutineKey(m.key)) continue;
    tiles.push({ key: m.key, label: m.label, value: m.range, week: sumKeys([m.key], weekRows), standard: !!m.headline });
  }
  const sendsQuotes = automations.some((a) => /quote/.test(a.workflow_type || "") || /quote/i.test(a.name || ""));
  // Slim layout: only Leads qualified + Appointments booked (each only if reported), Quotes sent only if a live
  // automation sends quotes, and a small Leads re-contacted only if reported. Activity tiles sit behind SHOW_ACTIVITY_TILES.
  const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));
  const coreTiles = [...KEEP_TILE_KEYS, ...(sendsQuotes ? ["quotes_sent"] : [])].map((k) => byKey[k]).filter((t) => t && t.value > 0); // reported zeros hidden like missing data
  const activityTiles = tiles.filter((t) => isCountedTile({ key: t.key, kind: metrics.find((m) => m.key === t.key)?.kind }) && !KEEP_TILE_KEYS.includes(t.key) && !["quotes_sent", "missed_followups_recovered"].includes(t.key) && t.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
  const headlineTiles = [...coreTiles, ...(SHOW_ACTIVITY_TILES ? activityTiles : [])];
  const recontacted = byKey.missed_followups_recovered?.value > 0 ? byKey.missed_followups_recovered.value : null;
  const firstEmit = reports.length ? reports.reduce((m, r) => (r.emitted_at < m ? r.emitted_at : m), reports[0].emitted_at) : null;
  const firstBase = firstEmit || client.created_at || new Date().toISOString();
  const firstNumbersBy = new Date(Date.parse(firstBase) + 7 * 86400000).toISOString();
  // Plan name only. No per-plan automation allowance: pricing is outcome-based, not workflow-count based.
  const PLAN = { starter: "Starter", core: "Core", full: "Full" };
  const plan = client.plan && PLAN[client.plan] ? { name: PLAN[client.plan] } : null;
  const rateIsDefault = !overrides || !Object.values(overrides).some((o) => o.hourly_wage != null) ? Number(client.hourly_rate) === DEFAULT_RATE : false;
  const legacyTimings = automations.flatMap((a) => Object.entries(a.default_minutes_per_unit || {}).filter(([k]) => reportedKeys.has(k)).map(([k, m]) => ({ automation: a.name, label: pretty(k), minutes: Number(m) })));
  const v2 = { headlineTiles, recontacted, showActivity: SHOW_ACTIVITY_TILES, firstNumbersBy, plan, rateIsDefault, legacyTimings, reportingCount: Object.keys(per).length,
    weekSummary: (SHOW_ACTIVITY_TILES ? headlineTiles : []).filter((t) => t.verb && t.week > 0).slice(0, 2).map((t) => `${t.verb} ${Math.round(t.week).toLocaleString()} ${t.noun}`) };
  // ---- range series: every range-based chart uses the selected from..to, bucketed to fit ----
  const size = bucketSize(from, to), bKeys = bucketKeys(from, to, size);
  const firstDay = {}; for (const r of reports) { const dd = r.period_start.slice(0, 10); if (!firstDay[r.automation_id] || dd < firstDay[r.automation_id]) firstDay[r.automation_id] = dd; }
  const bD = {}, bM = {};
  for (const r of inR) { const k = bucketOf(r.period_start, size), v = valueOf(r); const o = (bD[k] ||= {}); o[r.automation_id] = (o[r.automation_id] || 0) + v.dollars;
    for (const [mk, n] of Object.entries(r.counts || {})) { const x = ((bM[mk] ||= {})[k] ||= { sum: 0, n: 0 }); x.sum += Number(n); x.n++; } }
  const isAvg = (k) => catalog[k]?.kind === "duration_avg" || (!catalog[k] && isDur(k));
  const series = { size, buckets: bKeys.map((k) => ({ b: k, label: bucketLabel(k, size), dollars: bD[k] || {}, live: Object.values(firstDay).filter((f) => f <= bucketEnd(k, size)).length })) };
  for (const m of metrics) { m.series = bKeys.map((k) => { const x = bM[m.key]?.[k]; return { b: k, label: bucketLabel(k, size), v: !x || !x.n ? null : isAvg(m.key) ? x.sum / x.n : x.sum }; }); m.hasRangeData = m.series.some((p) => p.v != null && p.v !== 0); }
  const lyHas = Object.values(yoyW).some((y) => y.has);
  return {
    ...v2, testAutomations: Object.values(hiddenNames), series, weekly, recentWins, attention, issueNotes, resolvedIssues, resolutionsAvailable, lastUpdated, dataMonths, automationCount: ids.length, planPrice: client.plan_price != null ? Number(client.plan_price) : null,
    client, from, to, generated: new Date().toISOString(), ids, names, businessType: client.business_type,
    rates: [...new Set(usedRates.size || usedLegacy ? [...usedRates] : [...catRows.filter((c) => c.savable).map((c) => c.workflow_type)])].map((wt) => ({ ...rate(wt), metrics: catRows.filter((c) => c.workflow_type === wt).map((c) => catalog[c.metric_key].label) })),
    legacyRate: usedLegacy ? Number(client.hourly_rate) : null,
    metrics, workflows, totals, months, seasonal, seasonalYears: yrs, curMonth: curM, lyMonth: lyM, prevMonth: prevM, dom,
    mom: pct(curMtd, prevMtd), momBasis: `${curM} vs ${prevM}, days 1-${dom}`,
    yoy: { total: lyHas ? pct(curMtd, Object.values(yoyW).reduce((t, y) => t + y.ly, 0)) : null, per: ids.map((id) => ({ id, name: names[id], ...yoyW[id] })) },
    rolling12: { now: months[N - 1].rolling12, full: months[N - 1].rolling12Full },
    implemented: months[N - 1].implemented,
  };
}
const wonNote = (n) => { if (!n) return null; const t = n.replace(/^Backfilled from bot work logs\.?\s*/i, "").trim(); return t && !/counted|omitted|duplicate/i.test(t) ? t : null; };
export const fmtMetric = (m, v) => (v == null ? "–" : m.kind === "duration_avg" ? `${v.toFixed(1)} min` : Math.round(v).toLocaleString());
