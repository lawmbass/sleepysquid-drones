// Server-only: stable ids + admin resolve/reopen state for "Bot reports" items (portal.issue_resolutions).
import crypto from "crypto";
import { db } from "./db";
const enc = encodeURIComponent;
// One issue item per report today (index 0); the index keeps ids stable if reports ever carry several items.
export const issueId = (reportId, notes, i = 0) => crypto.createHash("sha256").update(`${reportId}:${i}:${notes || ""}`).digest("hex").slice(0, 24);
// Returns { available, byId }. If the table isn't there yet (migration not applied), resolving is just unavailable.
export async function loadResolutions(clientId) {
  try {
    const rows = await db(`portal_issue_resolutions?client_id=eq.${enc(clientId)}&select=issue_id,status,action,resolved_by,resolved_at`);
    return { available: true, byId: Object.fromEntries(rows.map((r) => [r.issue_id, r])) };
  } catch { return { available: false, byId: {} }; }
}
export async function setResolution({ clientId, items, action, by }) {
  const now = new Date().toISOString(), ids = items.map((x) => x.id);
  const prev = ids.length ? await db(`portal_issue_resolutions?issue_id=in.(${ids.map(enc).join(",")})&select=issue_id,history,resolved_by,resolved_at`) : [];
  const old = Object.fromEntries(prev.map((p) => [p.issue_id, p]));
  const reopen = action === "reopen";
  const rows = items.map((x) => ({ issue_id: x.id, client_id: clientId, report_id: x.reportId || null, status: reopen ? "open" : "resolved", action,
    resolved_by: reopen ? old[x.id]?.resolved_by ?? null : by, resolved_at: reopen ? old[x.id]?.resolved_at ?? null : now,
    updated_by: by, updated_at: now, history: [...(old[x.id]?.history || []), { action, by, at: now }] }));
  if (rows.length) await db("portal_issue_resolutions?on_conflict=issue_id", { method: "POST", body: rows, prefer: "resolution=merge-duplicates" });
  return rows.length;
}
