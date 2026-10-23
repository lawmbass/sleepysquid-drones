// Plain-word tags shared by the web dashboard and the PDF.
export function plainTag(t = "") {
  if (t.startsWith("OUTCOME")) return { label: "Counted", kind: "src", tip: "A result your automations recorded. Not turned into dollars." };
  if (t.startsWith("SOURCED: bot")) return { label: "Counted", kind: "src", tip: "Counted by your automations." };
  if (t.startsWith("SOURCED")) return { label: "Area wage (BLS, May 2025)", kind: "wage", tip: "Average hourly wage for this kind of work in the DC-MD-VA area, U.S. Bureau of Labor Statistics, May 2025." };
  if (t.startsWith("CLIENT")) return { label: "Your number", kind: "act", tip: "A number you gave us. It replaces our default." };
  return { label: "Estimate", kind: "est", tip: "Our estimate: times ran × typical minutes by hand × hourly wage." };
}
export const LEGEND = ["Counted", "Area wage (BLS, May 2025)", "Estimate", "Your number"];
export const DEFINITIONS = { leads_qualified: "answered our qualifying questions", missed_followups_recovered: "leads re-contacted" };
// Default hourly rate for new clients: slightly above the highest DMV minimum wage (DC $18.40 from Jul 1 2026; MD $15.00; VA $12.77).
// Keep in step with portal.clients.hourly_rate DEFAULT (supabase/drones/portal_010_default_rate_min_wage.sql).
export const DEFAULT_RATE = 19;
// Slim dashboard: activity tiles (emails handled, prospects researched, invoices reviewed, ...) are off by default.
// Flip to true to show them again on the dashboard and the PDF.
export const SHOW_ACTIVITY_TILES = true;
// Counted tiles kept in the slim layout, shown only when the client actually reports the key.
// Trend charts only for business-outcome metrics. Default hidden: housekeeping (archived, unsubscribes, vendor
// registrations, emails handled) still counts toward hours/value saved but gets no trend chart.
export const TREND_METRIC_KEYS = ["leads_qualified", "leads_received", "prospects_qualified", "appointments_booked", "jobs_booked", "quotes_sent", "estimates_sent", "invoices_sent", "invoices_reviewed", "invoices_paid", "payments_collected", "payments_reviewed", "reviews_received", "missed_followups_recovered", "deals_closed", "showings_booked", "renewals_signed"];
export const isTrendMetric = (m) => TREND_METRIC_KEYS.includes(m.key) || m.kind === "outcome";
// Counted tiles: outcome metrics (same rule as trend charts) plus client-facing work. Busywork rollups
// (emails handled = archived/deleted/filed, unsubscribes, vendor registrations, bid alerts, analysis chores) get no tile
// but still feed hours and value saved.
export const CLIENT_FACING_TILE_KEYS = ["outreach_sent", "prospects_researched"];
export const isCountedTile = (t) => isTrendMetric(t) || CLIENT_FACING_TILE_KEYS.includes(t.key);
export const KEEP_TILE_KEYS = ["leads_qualified", "appointments_booked"];
export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
export const FOOTER = "How we estimate: for each task, we multiply how many times it ran by the minutes it typically takes by hand, then convert to hours at your hourly rate. These are estimates, not an invoice or a guarantee. Want different numbers? Tell us your real rate or times and we'll use yours.";
export function headline(d, money) {
  if (!d.workflows.length || !(d.totals.dollars > 0)) return null;
  const top = d.workflows[0];
  return `Between ${d.from} and ${d.to}, your automations saved an estimated ${d.totals.hours.toFixed(0)} hours (about ${money(d.totals.dollars)}), led by ${top.name.toLowerCase()}.`;
}

// Friendly names for common back-office metric keys (dashboard + PDF).
export const FRIENDLY = { emails_filed: "Emails filed", gmail_threads_archived: "Gmail threads archived", yahoo_emails_archived: "Yahoo emails archived", invoices_reviewed: "Invoices reviewed", payments_reviewed: "Payments reviewed", prospects_researched: "Prospects researched", outreach_emails_sent: "Outreach emails sent", bids_found: "Bid alerts found", first_response_minutes: "Avg reply speed to new leads (min)", missed_followups_recovered: "Leads re-contacted" };
// Headline tiles that combine related keys. verb is used in the one-line summary.
export const TILE_GROUPS = [
  { id: "emails_handled", noun: "emails", label: "Emails handled", verb: "handled", keys: ["emails_filed", "gmail_threads_archived", "yahoo_emails_archived", "emails_archived", "reply_emails_sent", "client_emails_sent", "emails_handled"] },
  { id: "invoices_reviewed", noun: "invoices", label: "Invoices reviewed", verb: "reviewed", keys: ["invoices_reviewed"] },
  { id: "payments_reviewed", noun: "payments", label: "Payments reviewed", verb: "reviewed", keys: ["payments_reviewed"] },
  { id: "prospects_researched", noun: "prospects", label: "Prospects researched", verb: "researched", keys: ["prospects_researched"] },
  { id: "outreach_sent", noun: "outreach messages", label: "Outreach sent", verb: "sent", keys: ["outreach_emails_sent", "letters_mailed"] },
  { id: "bid_alerts", noun: "bids", label: "Bids reviewed", verb: "reviewed", keys: ["bids_found", "bid_opportunities_reviewed"] },
];
// Setup/housekeeping counts that aren't client-facing wins.
export const isRoutineKey = (k) => /^(routines_|connectors_|system_logins_)/.test(k);
// Report notes that describe a failure (vs. bookkeeping notes like backfill comments).
export const isErrorNote = (n) => !!n && n !== "EXAMPLE data" && !/^Backfilled from bot work logs/i.test(n);
// ---- admin "Errors reported" split: Needs attention vs Notes ----
// New bots tag notes as "[error] <reason>" or "[note] <text>" (ingest maps the optional `severity`/`reason`/`fix`
// fields onto notes, so schema_version 1 rows stay unchanged). An optional " || Fix: <who/what>" suffix carries the fix.
// Legacy untagged rows are classified by wording; error rows with no note show as "No details sent" under Notes.
const NEEDS = [
  [/1password|bill\.com/i, "Sign in to Bill.com through 1Password again so the bot can reach it (Lawrence)."],
  [/sign[- ]?in code|verification code|2fa|otp|code.*tim(ed|e) ?out|tim(ed|e) ?out.*code/i, "Send the bot a fresh sign-in code when it asks, or sign in once by hand (Lawrence)."],
  [/bid alert|bid.*sign[- ]?in|sign[- ]?in.*bid/i, "Sign the bid alerts bot back in to the bid site (Lawrence)."],
  [/never sent|not sent|wasn'?t sent|failed to send|send failed|didn'?t send|bounced/i, "Send it by hand, then check the bot's send connector (Lawrence or the bot owner)."],
  [/sign[- ]?in (needed|required|expired)|signed out|re-?auth|log ?in (needed|required|failed)|sign[- ]?in fail/i, "Sign the bot back in to the app (Lawrence)."],
  [/blocked|permission denied|access denied|forbidden/i, "Unblock the action or grant access, then rerun (Lawrence)."],
];
export function classifyIssue(notes, errors) {
  const raw = isErrorNote(notes) ? String(notes).trim() : "";
  const m = /^\[(error|note)\]\s*/i.exec(raw);
  let body = m ? raw.slice(m[0].length) : raw, fix = null;
  const f = /\s*\|\|\s*Fix:\s*/i.exec(body);
  if (f) { fix = body.slice(f.index + f[0].length).trim() || null; body = body.slice(0, f.index).trim(); }
  if (m) {
    const kind = m[1].toLowerCase();
    if (kind === "error" && !body) return { kind: "note", reason: "No details sent", fix: null, noDetails: true };
    return { kind: kind === "error" ? "attention" : "note", reason: body, fix: kind === "error" ? fix || (NEEDS.find(([re]) => re.test(body)) || [])[1] || null : null };
  }
  if (!body) return errors > 0 ? { kind: "note", reason: "No details sent", fix: null, noDetails: true } : null;
  const hit = NEEDS.find(([re]) => re.test(body));
  return hit ? { kind: "attention", reason: body, fix: fix || hit[1] } : { kind: "note", reason: body, fix: null };
}
export const shortDate = (s, tz) => new Date(s).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" });
// Connection tests / setup checks (e.g. Logs' "logs-connection-test") are plumbing, not client results:
// hidden from the client dashboard + PDF (count, charts, tiles, value, hours, trends); admin preview lists them as "test".
// Matches any of: portal.automations.internal = true; automation_id starting "logs-" or containing a test/setup-check word;
// or a report whose every count key is a test marker (test_*, connection_test*, setup_check*).
const TEST_ID = /^logs-|(^|[-_])(test|tests|connection-test|setup-check|healthcheck|health-check)([-_]|$)/i;
const TEST_KEY = /^(test_|connection_test|setup_check)/;
export const isTestCounts = (counts) => { const k = Object.keys(counts || {}); return k.length > 0 && k.every((x) => TEST_KEY.test(x)); };
export const isInternalAutomation = (a) => !!a && (a.internal === true || TEST_ID.test(a.automation_id || ""));
