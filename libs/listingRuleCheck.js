// "Would accept / why not" for FlyGuys and Droners listings. The bot scores
// these at intake (drone-gigs sources/score-listing.js) and stores the result
// on raw_detail.score. Nothing is accepted from this; it is a preview only.

const LABELS = [
  [/^payout_not_found/, () => "No payout found"],
  [/^payout_below_minimum: payout=(\S+) minimum=(\S+)/, (m) => `Payout $${m[1]} is under the $${m[2]} minimum`],
  [/^too_far: travel_minutes=(\S+) max_drive_minutes=(\S+)/, (m) => `${m[1]} min drive is over the ${m[2]} min limit`],
  [/^long_trip_payout_below_minimum:.*travel_minutes=(\S+).*payout=(\S+) minimum_payout=(\S+)/, (m) => `Long trip (${m[1]} min) needs $${m[3]}+, pays $${m[2]}`],
  [/^not_enough_notice: hours_until_flight=(\S+) min_notice_hours=(\S+)/, (m) => `Only ${m[1]} h notice (needs ${m[2]} h)`],
  [/^daily_cap_reached: accepted_today=(\S+) cap=(\S+)/, (m) => `Daily cap reached (${m[1]}/${m[2]})`],
  [/^daily_cap_unreadable/, () => "Couldn't read today's accept count"],
  [/^(needs_review: )?location_not_found/, () => "No address found"],
  [/^geocode_(error|failed)/, () => "Couldn't find the address on the map"],
  [/^travel_time_unavailable/, () => "Drive time unavailable"],
];

export function ruleReasonLabel(reason) {
  const text = String(reason || "").trim();
  for (const [pattern, label] of LABELS) {
    const match = text.match(pattern);
    if (match) return label(match);
  }
  return text;
}

export function listingRuleCheck(listing) {
  const detail = listing?.rawDetail ?? listing?.raw_detail;
  const score = detail && typeof detail === "object" ? detail.score : null;
  if (!score || typeof score !== "object") return null;
  if (score.would_accept == null) {
    return { state: "error", label: "Rules check failed", reasons: score.error ? [String(score.error)] : [] };
  }
  const reasons = Array.isArray(score.reasons) ? score.reasons.map(ruleReasonLabel) : [];
  if (score.would_accept) return { state: "pass", label: "Would accept", reasons: [] };
  if (score.needs_review) return { state: "review", label: "Needs review", reasons };
  return { state: "fail", label: "Wouldn't accept", reasons };
}
