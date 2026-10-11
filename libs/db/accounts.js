import { assertNoError, db } from "@/libs/db/shared";

export async function findOAuthAccountByUserId(userId) {
  const { data, error } = await db()
    .from("oauth_accounts")
    .select("id, user_id, provider, provider_account_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  return data;
}

export async function upsertOAuthAccount({ userId, provider, providerAccountId }) {
  const { error } = await db()
    .from("oauth_accounts")
    .upsert(
      {
        user_id: userId,
        provider,
        provider_account_id: providerAccountId,
      },
      { onConflict: "provider,provider_account_id" }
    );
  assertNoError(error);
}

export async function deleteOAuthAccountsForUser(userId) {
  const { error } = await db().from("oauth_accounts").delete().eq("user_id", userId);
  assertNoError(error);
}
