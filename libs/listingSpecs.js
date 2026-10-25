// Formatting for listing Equipment / Deliverables items: short labels stay chips,
// long text becomes readable bullets, and the Zeitview camera boilerplate that
// shows up in both lists is shown once (under Deliverables).

export const CHIP_MAX = 40;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function itemLabel(item) {
  if (item == null) return "";
  if (typeof item === "object") return clean(item.name || item.label || item.title || item.description || "");
  return clean(item);
}

// Normalize for comparing items across sections.
export function itemKey(item) {
  return itemLabel(item).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tidyFormats(text) {
  return clean(text).replace(/\(([^)]*)\)/g, ", $1").replace(/\bformats?\b/gi, "").replace(/\s*,\s*,?/g, ", ").replace(/[\s,]+$/, "").trim();
}

// Split long spec text into short bullet lines.
export function specBullets(text) {
  let rest = clean(text).replace(/^camera settings:?\s*/i, "");
  const bullets = [];
  const unless = rest.match(/\(?\s*unless otherwise specified[^)]*\)?\.?/i);
  if (unless) rest = rest.replace(unless[0], " ");
  const labelRe = /\b(Video|Image|Photos?|Images?)\s*:\s*/gi;
  const marks = [...rest.matchAll(labelRe)];
  const tail = [];
  let lead = marks.length ? rest.slice(0, marks[0].index) : rest;
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : rest.length;
    const [first, ...more] = clean(rest.slice(m.index + m[0].length, end)).split(/(?<=[.!?])\s+(?=[A-Z])/);
    let body = tidyFormats(first).replace(/\.$/, "");
    tail.push(...more);
    body = body.replace(/(\d+)\s*px\s*x\s*(\d+)\s*px/i, "$1×$2");
    bullets.push(`${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}: ${body}`);
  });
  lead = clean([lead, ...tail].join(" "));
  if (lead) {
    const sentences = lead.split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
    const notes = sentences.map((s) => (/^check exposure/i.test(s) ? `Note: ${s.replace(/\.$/, "")}` : s.replace(/\.$/, "")).replace(/^Note:\s*/i, "Note: ").replace(/^(Note: )?(\w)/, (a, n, c) => (n || "") + c.toUpperCase()));
    bullets.unshift(...notes);
    // Keep the Video/Image specs first, the note after.
    if (marks.length) bullets.push(...bullets.splice(0, notes.length));
  }
  if (unless) bullets.push("Unless special instructions say otherwise");
  return bullets.length ? bullets : [clean(text)];
}

// Split items into short chips and long blocks (each block -> bullets).
export function formatItems(items) {
  const chips = [];
  const blocks = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const label = itemLabel(item);
    const key = itemKey(item);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    if (label.length <= CHIP_MAX) chips.push(label);
    else blocks.push(specBullets(label));
  }
  return { chips, blocks };
}

// Drop equipment/cert items that are repeated verbatim in deliverables.
export function dedupeEquipment(equipment, deliverables) {
  const keys = new Set((Array.isArray(deliverables) ? deliverables : []).map(itemKey).filter(Boolean));
  return (Array.isArray(equipment) ? equipment : []).filter((item) => !keys.has(itemKey(item)));
}
