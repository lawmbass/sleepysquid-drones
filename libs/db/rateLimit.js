import { assertNoError, db } from "@/libs/db/shared";

export async function checkAuthRateLimit(identifier, maxAttempts = 5, windowMinutes = 15) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString();

  await db()
    .from("rate_limit_events")
    .delete()
    .eq("identifier", identifier)
    .lt("created_at", windowStart);

  const { count, error } = await db()
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .gte("created_at", windowStart);
  assertNoError(error);

  const recentAttempts = count || 0;
  let resetTime = null;
  if (recentAttempts > 0) {
    const { data, error: earliestError } = await db()
      .from("rate_limit_events")
      .select("created_at")
      .eq("identifier", identifier)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    assertNoError(earliestError);
    if (data?.created_at) {
      resetTime = new Date(new Date(data.created_at).getTime() + windowMinutes * 60 * 1000);
    }
  }

  return {
    isLimited: recentAttempts >= maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - recentAttempts),
    resetTime,
  };
}

export async function recordAuthRateLimit(identifier) {
  const { error } = await db().from("rate_limit_events").insert({ identifier });
  assertNoError(error);

  const cleanupTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db().from("rate_limit_events").delete().lt("created_at", cleanupTime);
}
