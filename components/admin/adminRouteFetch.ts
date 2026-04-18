"use client";

import { supabase } from "@/lib/supabase";

/**
 * Zelfde auth-context als aanbevolen Supabase-flow: eerst JWT valideren/verversen (`getUser`),
 * daarna access token uit de actuele sessie voor `Authorization: Bearer`.
 */
export async function getAccessTokenForAdminRoutes(): Promise<string | null> {
  const { error: userErr } = await supabase.auth.getUser();
  if (userErr) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token ?? null;
}

export const ADMIN_API_FETCH_BASE: Pick<RequestInit, "credentials"> = {
  credentials: "same-origin",
};
