import { createClient } from "@supabase/supabase-js";

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

let adminClient;
let anonClient;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

/**
 * Server-only client. Uses the service-role key and bypasses RLS.
 * Call this only after the NextAuth session (or an equivalent server check)
 * has been verified. Never import it from a browser component.
 */
export function getSupabaseAdmin() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase service-role client is server-only");
  }

  if (!adminClient) {
    adminClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      CLIENT_OPTIONS
    );
  }

  return adminClient;
}

/** Anon client. Subject to RLS. Used by the RLS check script. */
export function getSupabaseAnon() {
  if (!anonClient) {
    anonClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      CLIENT_OPTIONS
    );
  }

  return anonClient;
}

export const SUPABASE_PROJECT_REF = "etbesmtdsjlmadaexvrv";
export const SUPABASE_PROJECT_URL = "https://etbesmtdsjlmadaexvrv.supabase.co";
