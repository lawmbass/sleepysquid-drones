import { displayNameFor, isMissingGigSourcesTable } from "@/libs/gigSources";
import { assertNoError, db } from "@/libs/db/shared";

export function mapGigSource(row) {
  if (!row) return null;
  return {
    sourceKey: row.source_key,
    displayName: row.display_name || "",
    enabled: row.enabled === true,
    lastHealth: row.last_health || null,
    lastSuccessAt: row.last_success_at || null,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
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

export async function setGigSourceEnabled({ sourceKey, enabled, updatedBy, rows }) {
  const { data, error } = await db()
    .from("gig_sources")
    .upsert(
      {
        source_key: sourceKey,
        display_name: displayNameFor(sourceKey, rows),
        enabled,
        updated_by: updatedBy || null,
      },
      { onConflict: "source_key" }
    )
    .select("*")
    .single();
  if (error && isMissingGigSourcesTable(error)) {
    return { tableReady: false, row: null };
  }
  assertNoError(error);
  return { tableReady: true, row: mapGigSource(data) };
}
