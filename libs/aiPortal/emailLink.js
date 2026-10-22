// One-time sign-in links for SleepySquid AI clients, stored hashed in portal.login_tokens (same table and rules as
// ai.sleepysquid.com/portal/login: 15 minute expiry, single use, only for active portal clients or admins).
import crypto from "crypto";
import { db, activeClientIds } from "./db";
import { adminConfig } from "@/libs/adminConfig";

export const LINK_TTL_MS = 15 * 60 * 1000;
export const DEDUPE_MS = 45 * 1000;
export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const enc = encodeURIComponent;

export async function mayUseEmailLink(email) {
  return adminConfig.isAdmin(email) || (await activeClientIds(email)).length > 0;
}

// Returns a raw token to email, or null when a link was already issued in the last DEDUPE_MS.
export async function issueLoginToken(email, now = Date.now()) {
  const since = new Date(now - DEDUPE_MS).toISOString();
  const recent = await db(`portal_login_tokens?email=eq.${enc(email)}&used_at=is.null&created_at=gt.${enc(since)}&select=created_at&limit=1`);
  if (recent.length) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  await db("portal_login_tokens", { method: "POST", body: { token_hash: sha256(token), email, expires_at: new Date(now + LINK_TTL_MS).toISOString() } });
  return token;
}

// Atomically marks the token used (only if unused and unexpired). Returns the email, or null.
export async function consumeLoginToken(token) {
  const t = String(token || "");
  if (t.length < 20 || t.length > 200) return null;
  const rows = await db(`portal_login_tokens?token_hash=eq.${sha256(t)}&used_at=is.null&expires_at=gt.${enc(new Date().toISOString())}&select=email`,
    { method: "PATCH", body: { used_at: new Date().toISOString() }, prefer: "return=representation" });
  if (!rows?.length) return null;
  const email = rows[0].email;
  // a link issued before the client was deleted must not sign anyone in
  return (await mayUseEmailLink(email)) ? email : null;
}
