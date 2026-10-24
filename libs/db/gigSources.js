import { displayNameFor, isMissingGigSourcesTable } from "@/libs/gigSources";
import { assertNoError, db } from "@/libs/db/shared";

const SYNC_RESULTS = new Set(["ok", "failed", "nothing"]);

function missingSyncColumn(error) {
  const code = String(error?.code || "");
  const message = `${error?.message || ""} ${error?.details || ""}`;
  if (!/profile_sync_/i.test(message)) return false;
  return code === "PGRST204" || code === "42703" || /schema cache|does not exist|could not find/i.test(message);
}

export function mapGigSource(row) {
  if (!row) return null;
  const profileSyncAvailable = Object.prototype.hasOwnProperty.call(row, "profile_sync_result")
    || Object.prototype.hasOwnProperty.call(row, "profile_sync_at")
    || Object.prototype.hasOwnProperty.call(row, "profile_sync_requested_at");
  const result = SYNC_RESULTS.has(row.profile_sync_result) ? row.profile_sync_result : null;
  return {
    sourceKey: row.source_key,
    displayName: row.display_name || "",
    enabled: row.enabled === true,
    lastHealth: row.last_health || null,
    lastSuccessAt: row.last_success_at || null,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
    profileSyncAvailable,
    profileSyncAt: row.profile_sync_at || null,
    profileSyncResult: result,
    profileSyncError: typeof row.profile_sync_error === "string" ? row.profile_sync_error : null,
    profileSyncObserved: row.profile_sync_observed && typeof row.profile_sync_observed === "object"
      ? row.profile_sync_observed
      : null,
    profileSyncRequestedAt: row.profile_sync_requested_at || null,
  };
}

export async function listGigSources() {
  const { data, error } = await db().from("gig_sources").select("*").order("source_key", { ascending: true });
  if (error && isMissingGigSourcesTable(error)) {
    return { tableReady: false, rows: [] };
  }
  assertNoError(error);
  return { tableReady: true, rows: (data || []).map(mapGigSource) };
}

async function upsertGigSource(payload) {
  const { data, error } = await db()
    .from("gig_sources")
    .upsert(payload, { onConflict: "source_key" })
    .select("*")
    .single();
  return { data, error };
}

export async function setGigSourceEnabled({ sourceKey, enabled, updatedBy, rows }) {
  const payload = {
    source_key: sourceKey,
    display_name: displayNameFor(sourceKey, rows),
    enabled,
    updated_by: updatedBy || null,
  };
  if (enabled) payload.profile_sync_requested_at = new Date().toISOString();
  let saved = await upsertGigSource(payload);
  if (saved.error && missingSyncColumn(saved.error)) {
    delete payload.profile_sync_requested_at;
    saved = await upsertGigSource(payload);
  }
  if (saved.error && isMissingGigSourcesTable(saved.error)) {
    return { tableReady: false, row: null };
  }
  assertNoError(saved.error);
  return { tableReady: true, row: mapGigSource(saved.data) };
}

/**
 * Ask the drone-gigs bot to push the shared home address and travel radius
 * to every enabled source. Disabled sources are left alone. A missing sync
 * column does not fail the rules save.
 */
export async function requestEnabledProfileSync() {
  const { error } = await db()
    .from("gig_sources")
    .update({ profile_sync_requested_at: new Date().toISOString() })
    .eq("enabled", true);
  if (error && (isMissingGigSourcesTable(error) || missingSyncColumn(error))) {
    return { ok: false };
  }
  assertNoError(error);
  return { ok: true };
}
