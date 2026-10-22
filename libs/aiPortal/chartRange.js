// Pure helpers: bucket the selected dashboard range so every range-based chart uses the same domain as the tiles.
const DAY = 86400000;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
// daily up to ~5 weeks (this week, this month, last month), weekly up to ~4 months (90 days), monthly beyond.
export function bucketSize(from, to) { const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1; return days <= 35 ? "day" : days <= 120 ? "week" : "month"; }
const monday = (ms) => { const d = new Date(ms); return ms - ((d.getUTCDay() + 6) % 7) * DAY; };
export function bucketOf(dateIso, size) { const ms = Date.parse(dateIso.slice(0, 10) + "T00:00:00Z"); return size === "day" ? iso(ms) : size === "week" ? iso(monday(ms)) : dateIso.slice(0, 7); }
export function bucketKeys(from, to, size) {
  const out = [], a = Date.parse(from + "T00:00:00Z"), b = Date.parse(to + "T00:00:00Z");
  for (let t = a; t <= b; t += DAY) { const k = bucketOf(iso(t), size); if (out[out.length - 1] !== k) out.push(k); }
  return out;
}
export function bucketLabel(k, size) { return size === "month" ? `${MON[+k.slice(5, 7) - 1]} ${k.slice(2, 4)}` : `${MON[+k.slice(5, 7) - 1]} ${+k.slice(8, 10)}`; }
// last calendar day covered by a bucket key (for "live by" counts)
export function bucketEnd(k, size) { if (size === "day") return k; if (size === "week") return iso(Date.parse(k + "T00:00:00Z") + 6 * DAY); const [y, m] = k.split("-").map(Number); return iso(Date.UTC(y, m, 0)); }
export const compact = (v) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
