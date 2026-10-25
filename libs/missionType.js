// Mirror of drone-gigs/mission-type.js. Keep the two in sync.
// Mission type for a listing.
// 1. A real type from the source wins: an explicit "Mission Type" field, or the
//    Zeitview "Scope:" line in Special Instructions, or "Type:" in a text/email.
// 2. Otherwise infer from job-specific info only (title, client/partner,
//    special instructions, shot list / flight plan, deliverables, SMS text).
//    Boilerplate that appears on every Zeitview page/email is stripped first.
// 3. No real signal -> null. Never guess.
// Returns { type, source } where source is 'zeitview' | 'flyguys' | 'droners' | 'inferred' | null.

const BOILERPLATE = [
  /check exposure and set your white balance[^\n]*/gi,
  /\bvideo:\s*4k[^\n]*/gi,
  /\bimage:\s*\d+px[^\n]*/gi,
  /\(unless otherwise specified in special instructions\)/gi,
  /camera settings/gi,
  /weather requirements[^\n]*/gi,
  /accepted drones \(at least one\)[^\n]*/gi,
  /you must arrive on time[^\n]*/gi,
  /this mission is prescheduled[^\n]*/gi,
  /if there is a discrepancy between the altitude[^\n]*?final authority\.?/gi,
  /if the mission cannot be flown due to this restriction[^\n]*/gi,
  /ready to fly\?[^\n]*/gi,
  /a new mission is available near you\.?/gi,
  /a client mission is available near you\.?/gi,
  /please log into your pilot dashboard[^\n]*/gi,
  /map plan photo plan video plan panorama plan/gi,
  /this is not a shot list!?/gi,
  /do not upload to zeitview!?/gi,
  /pre-flight checklist|shot list and descriptions|airspace authorization|on-site information|upload assets/gi,
];

const KNOWN_TYPE_LABEL = /\b(?:mission|job|project)\s*type\s*[:\-]\s*([^\n,.;|$]{2,40})/i;
const SCOPE_LABEL = /\bscope\s*:\s*([^\n.;|]{2,40})/i;

const RULES = [
  ['Real Estate', /\breal[\s-]?estate\b|\btruplace\b|\bmatterport\b|\bhomejab\b|\bvirtuance\b|\bhome listing\b|\blisting photos?\b/i],
  ['Roof Inspection', /\broof(?:top|ing)?\b/i],
  ['Solar Inspection', /\bsolar\b|\bpv (?:array|panel)s?\b/i],
  ['Cell Tower Inspection', /\b(?:cell|telecom)\s*(?:tower|site)\b|\bmonopole\b/i],
  ['Construction Progress', /\bconstruction\b|\bprogress (?:photo|monitor)/i],
  ['Insurance Inspection', /\binsurance\b|\bstorm damage\b|\bhail damage\b|\bclaim\b/i],
  ['Mapping / Survey', /\bmapping\b|\bsurvey\b|\borthomosaic\b|\bphotogrammetry\b|\blidar\b|\bgrid\/mapping\b/i],
  ['Inspection', /\binspection\b|\bbridge\b|\bwind turbine\b|\bpower ?lines?\b/i],
  ['Agriculture', /\bagricultur\w*|\bcrops?\b|\bfarm(?:land)?\b/i],
  ['Event', /\bwedding\b|\bconcert\b|\bevent coverage\b/i],
  ['Property Photos', /\bcardinal directions\b|\bbirds?[\s-]?eye\b|\blow level shots?\b/i],
  ['Video', /\bvideo(?:graphy)?\b|\bcinematic\b|\bfootage\b/i],
  ['Aerial Photos', /\baerial (?:photos?|images?|photography)\b/i],
];

function textOf(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textOf).join('\n');
  if (typeof value === 'object') {
    return [value.name, value.label, value.type, value.shot_type, value.description].map(textOf).join(' ');
  }
  return String(value);
}

export function stripBoilerplate(text) {
  let out = String(text || '');
  for (const pattern of BOILERPLATE) out = out.replace(pattern, ' ');
  return out;
}

function titleCase(value) {
  return String(value).trim().replace(/\s+/g, ' ').replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function realType({ explicit, specialInstructions, text, source }) {
  const stated = String(explicit || '').trim();
  if (stated) return { type: stated, source: source || 'zeitview' };
  const special = textOf(specialInstructions);
  const scope = special.match(SCOPE_LABEL);
  if (scope) return { type: titleCase(scope[1]), source: source || 'zeitview' };
  const labeled = String(text || '').match(KNOWN_TYPE_LABEL);
  if (labeled) return { type: titleCase(labeled[1]), source: source || 'zeitview' };
  return null;
}

function inferType({ title, clientName, partner, specialInstructions, flightPlan, deliverables, requirements, text, acreage }) {
  const haystack = stripBoilerplate([
    title,
    clientName,
    partner,
    textOf(specialInstructions),
    textOf(flightPlan),
    textOf(deliverables),
    textOf(requirements),
    text,
  ].map(textOf).join('\n'));
  if (/\bdronedeploy\b/i.test(`${partner || ''} ${clientName || ''}`) && Number(acreage) >= 5) {
    return 'Mapping / Survey';
  }
  for (const [type, pattern] of RULES) {
    if (pattern.test(haystack)) return type;
  }
  return null;
}

export function resolveMissionType(input = {}) {
  const real = realType(input);
  if (real) return real;
  const inferred = inferType(input);
  return inferred ? { type: inferred, source: 'inferred' } : { type: null, source: null };
}


// Resolve a stored listing (camelCase or DB row). Returns { type, source }.
export function resolveListingMissionType(listing) {
  if (!listing) return { type: null, source: null };
  const detail = listing.rawDetail || listing.raw_detail || {};
  const parsed = detail.parsed || {};
  const stored = String(listing.missionType || listing.mission_type || detail.mission_type || parsed.mission_type || "").trim();
  if (stored) return { type: stored, source: detail.mission_type_source || listing.source || "zeitview" };
  const source = listing.source || null;
  const textSource = source === "zeitview" ? null : (listing.rawEmailText || listing.raw_email_text);
  return resolveMissionType({
    specialInstructions: parsed.special_instructions,
    title: listing.title === "Not Found" ? null : listing.title || parsed.title,
    clientName: listing.clientName || listing.client_name || parsed.client_name,
    partner: parsed.partner,
    flightPlan: listing.flightPlan || listing.flight_plan || parsed.flight_plan,
    deliverables: listing.deliverables || parsed.deliverables,
    requirements: [listing.requiredEquipment || listing.required_equipment, parsed.required_certifications],
    acreage: parsed.acreage ?? detail.acreage,
    text: textSource,
    source: source || undefined,
  });
}

export function deriveMissionType(listing) {
  return resolveListingMissionType(listing).type;
}
