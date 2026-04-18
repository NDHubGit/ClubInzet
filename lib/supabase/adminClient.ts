import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

/**
 * Geen throw: gebruikt door `requireAdminRequest` om 503 JSON te sturen vóór `getAdminClient()`.
 */
export function getAdminServerConfigError(): string | null {
  if (typeof window !== "undefined") {
    return "adminClient mag alleen op de server";
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) return "NEXT_PUBLIC_SUPABASE_URL ontbreekt";
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY ontbreekt";
  return null;
}

/**
 * Supabase met **service role** — alleen `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
 * Geen anon-fallback. Trim op keys voorkomt o.a. "Invalid API key" bij per ongeluk ingelezen newlines in `.env`.
 */
export function getAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("adminClient: alleen server-side importeren (niet in client bundles).");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (process.env.CLUBINZET_DEBUG_ADMIN_AUTH === "1") {
    console.log("[admin-auth-debug] adminClient env", {
      hasUrl: Boolean(url),
      hasServiceRoleKey: Boolean(key),
      keyLength: key?.length ?? 0,
      keyPrefix: key ? `${key.slice(0, 6)}...` : null,
    });
  }

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ontbreekt");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt");

  if (!cached) {
    cached = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}

/**
 * Zelfde client als `getAdminClient()`; proxy voorkomt `getAdminClient()` bij import tijdens build.
 * Nooit importeren in `"use client"` componenten.
 */
export const adminClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getAdminClient(), prop, receiver);
  },
});
