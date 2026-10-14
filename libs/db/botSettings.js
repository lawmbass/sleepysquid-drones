import { previewDecisions, zeitviewFromRow, zeitviewRadiusColumn } from "@/libs/botRules";
import { assertNoError, db, fetchAll, num } from "@/libs/db/shared";

export function mapBotSettings(row) {
  if (!row) return null;
  return {
    autoAcceptEnabled: row.auto_accept_enabled === true,
    minPayoutUsd: num(row.min_payout_usd),
    longTripMinutes: num(row.long_trip_minutes),
    longTripMinPayoutUsd: num(row.long_trip_min_payout_usd),
    maxDriveMinutes: row.max_drive_minutes == null ? null : num(row.max_drive_minutes),
    homeAddress: row.home_address,
    homeLat: num(row.home_lat),
    homeLng: num(row.home_lng),
    dailyAcceptCap: row.daily_accept_cap == null ? null : num(row.daily_accept_cap),
    minNoticeHours: row.min_notice_hours == null ? null : num(row.min_notice_hours),
    updatedAt: row.updated_at || null,
    updatedBy: row.updated_by || null,
    ...zeitviewFromRow(row),
  };
}

function toRow(settings, updatedBy) {
  return {
    id: 1,
    auto_accept_enabled: settings.autoAcceptEnabled,
    min_payout_usd: settings.minPayoutUsd,
    long_trip_minutes: settings.longTripMinutes,
    long_trip_min_payout_usd: settings.longTripMinPayoutUsd,
    max_drive_minutes: settings.maxDriveMinutes,
    home_address: settings.homeAddress,
    home_lat: settings.homeLat,
    home_lng: settings.homeLng,
    daily_accept_cap: settings.dailyAcceptCap,
    min_notice_hours: settings.minNoticeHours,
    updated_by: updatedBy || null,
  };
}

export function settingsRow(settings, updatedBy) {
  const row = toRow(settings, updatedBy);
  const radius = zeitviewRadiusColumn(settings);
  if (radius.write) row.zeitview_radius_miles = radius.value;
  return row;
}

function missingZeitviewColumn(error) {
  const code = String(error?.code || "");
  const message = `${error?.message || ""} ${error?.details || ""}`;
  if (!/zeitview_radius_miles/i.test(message)) return false;
  return code === "PGRST204" || code === "42703" || /schema cache|does not exist|could not find/i.test(message);
}

export async function getBotSettings() {
  const { data, error } = await db().from("bot_settings").select("*").eq("id", 1).maybeSingle();
  assertNoError(error);
  return mapBotSettings(data);
}

async function upsertSettings(row) {
  const { data, error } = await db()
    .from("bot_settings")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();
  assertNoError(error);
  return mapBotSettings(data);
}

export async function saveBotSettings(settings, updatedBy) {
  const row = settingsRow(settings, updatedBy);
  try {
    return await upsertSettings(row);
  } catch (error) {
    if (!Object.prototype.hasOwnProperty.call(row, "zeitview_radius_miles") || !missingZeitviewColumn(error)) {
      throw error;
    }
    delete row.zeitview_radius_miles;
    return upsertSettings(row);
  }
}

function previewColumns(includeNotice) {
  const columns = [
    "id",
    "external_mission_id",
    "payout",
    "travel_time",
    "first_seen_at",
    "title",
    "address",
    "latitude",
    "longitude",
  ];
  if (includeNotice) {
    columns.push("raw_detail", "due_window_start", "due_window_end", "deadline", "last_seen_at");
  }
  return columns.join(", ");
}

export async function loadPreviewListings(settings, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await fetchAll(() =>
    db()
      .from("mission_listings")
      .select(previewColumns(settings.minNoticeHours != null))
      .gte("first_seen_at", since)
      .order("first_seen_at", { ascending: true })
  );

  return rows.map((row) => ({
    id: row.id,
    externalMissionId: row.external_mission_id,
    payout: num(row.payout),
    travelTime: num(row.travel_time),
    firstSeenAt: row.first_seen_at,
    title: row.title,
    address: row.address,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    rawDetail: row.raw_detail || null,
    dueWindowStart: row.due_window_start || null,
    dueWindowEnd: row.due_window_end || null,
    deadline: row.deadline || null,
    lastSeenAt: row.last_seen_at || null,
  }));
}

export async function previewBotSettings(settings, now = new Date()) {
  const listings = await loadPreviewListings(settings, now);
  return previewDecisions(listings, settings, now);
}
