import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchOrCreateClientProfile } from "@/lib/auth/clientProfile";
import type { RequestUserProfile } from "@/lib/auth/getRequestUser";

export type ClientSessionResult = {
  user: { id: string; email?: string | null };
  profile: RequestUserProfile | null;
};

/**
 * Client: zelfde gegevens als `getRequestUser` op de server, via cookies (`/api/auth/session`).
 */
export async function getSessionUser(): Promise<ClientSessionResult | null> {
  const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ClientSessionResult;
}

/**
 * Na login/callback: eerst server (`getRequestUser`), anders directe client-query
 * (direct na `signIn` zijn cookies soms nog niet zichtbaar voor de API-route).
 */
export async function loadSessionWithProfile(supabase: SupabaseClient): Promise<ClientSessionResult | null> {
  const fromApi = await getSessionUser();
  if (fromApi) return fromApi;

  const r = await fetchOrCreateClientProfile(supabase, "[SESSION]");
  if (!r.ok) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { user: { id: user.id, email: user.email ?? null }, profile: r.profile };
}
