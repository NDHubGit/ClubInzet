import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchOrCreateClientProfile } from "@/lib/auth/clientProfile";
import type { RequestUserProfile } from "@/lib/auth/getRequestUser";

export type ClientSessionResult = {
  user: { id: string; email?: string | null };
  profile: RequestUserProfile | null;
};

/**
 * Server-session ophalen met **Bearer vóór** cookie-only: zo voorkom je dat een lege/verkeerde
 * cookie-sessie telt terwijl er wél een geldige `access_token` in de browserclient zit.
 */
export async function getSessionUser(supabase: SupabaseClient): Promise<ClientSessionResult | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: HeadersInit = { Accept: "application/json" };
  if (session?.access_token) {
    (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch("/api/auth/session", {
    credentials: "include",
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as ClientSessionResult;
}

/**
 * Profiel altijd via authenticated browserclient laden (JWT), niet cookie-first zonder token.
 */
export async function loadSessionWithProfile(supabase: SupabaseClient): Promise<ClientSessionResult | null> {
  const r = await fetchOrCreateClientProfile(supabase, "[SESSION]");
  if (!r.ok) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { user: { id: user.id, email: user.email ?? null }, profile: r.profile };
}
