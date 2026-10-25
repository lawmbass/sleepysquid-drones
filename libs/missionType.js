// Mission type for a listing. The bot only stores mission_type when the page
// has an explicit "Mission Type" field, which Zeitview pages, FlyGuys texts
// and Droners emails rarely do, so derive it from the text we already have.

const RULES = [
  ["Real Estate", /\breal[\s-]?estate\b|\blisting photos?\b|\bproperty (?:photo|marketing)\b|\bresidential (?:photo|exterior)\b/i],
  ["Roof Inspection", /\broof(?:top|ing)?\b/i],
  ["Solar Inspection", /\bsolar\b|\bpv (?:array|panel)s?\b|\bthermal\b/i],
  ["Cell Tower Inspection", /\b(?:cell|telecom|communication)s? ?(?:tower|site)\b|\bcell ?site\b|\bmonopole\b/i],
  ["Construction Progress", /\bconstruction\b|\bjob ?site progress\b|\bprogress (?:photo|monitor)/i],
  ["Insurance Inspection", /\binsurance\b|\bclaims?\b|\bstorm damage\b|\bhail\b/i],
  ["Mapping / Survey", /\bmapping\b|\bsurvey\b|\borthomosaic\b|\bphotogrammetry\b|\bgrid\b|\blidar\b/i],
  ["Inspection", /\binspection\b|\bbridge\b|\bwind turbine\b|\butility\b|\bpower ?lines?\b/i],
  ["Agriculture", /\bagricultur|\bcrop\b|\bfarm\b/i],
  ["Event", /\bevent\b|\bwedding\b|\bconcert\b/i],
  ["Video", /\bvideo(?:graphy)?\b|\bcinematic\b|\bfootage\b/i],
  ["Photography", /\bphoto(?:s|graphy)?\b|\baerial (?:photo|image)/i],
];

function textOf(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return [value.name, value.label, value.type, value.shot_type, value.description].map(textOf).join(" ");
  return String(value);
}

export function deriveMissionType(listing) {
  if (!listing) return null;
  const detail = listing.rawDetail || listing.raw_detail || {};
  const explicit = String(
    listing.missionType || listing.mission_type || detail.mission_type || detail.missionType || detail.parsed?.missionType || ""
  ).trim();
  if (explicit) return explicit;

  const labeled = String(listing.rawEmailText || listing.raw_email_text || "").match(/\b(?:mission|job|project)\s*type\s*[:\-]\s*([^\n,.;]{2,40})/i);
  if (labeled) return labeled[1].trim();

  const haystack = [
    listing.title,
    listing.clientName || listing.client_name,
    textOf(listing.deliverables),
    textOf(listing.requiredEquipment || listing.required_equipment),
    textOf(listing.flightPlan || listing.flight_plan),
    listing.rawEmailText || listing.raw_email_text,
  ].map(textOf).join("\n");
  for (const [type, pattern] of RULES) {
    if (pattern.test(haystack)) return type;
  }
  return null;
}
