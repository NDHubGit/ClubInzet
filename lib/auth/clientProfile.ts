import type { SupabaseClient } from "@supabase/supabase-js";

import type { RequestUserProfile } from "@/lib/auth/getRequestUser";

export type FetchOrCreateClientProfileResult =
  | { ok: true; profile: RequestUserProfile }
  | { ok: false; code: "no_user" | "select_error" | "no_profile_after_insert" };

/**
 * Client-side sessie: profiel uit `profiles`; ontbreekt die → insert (zelfde pad als login/callback,
 * geen afhankelijkheid van server-cookiesync).
 */
export async function fetchOrCreateClientProfile(
  supabase: SupabaseClient,
  logUserPrefix: string
): Promise<FetchOrCreateClientProfileResult> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, code: "no_user" };
  }

  console.log(logUserPrefix, user.id);

  const { data: profile, error: selErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    console.error("[PROFILE SELECT]", selErr);
    return { ok: false, code: "select_error" };
  }

  console.log("[PROFILE RESULT]", profile);

  let resolved: RequestUserProfile | null = profile as RequestUserProfile | null;

  if (!resolved) {
    console.warn("Creating missing profile");
    const em = user.email ?? "";
    const { data: newProfile, error: insErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: em || null,
        role: "user",
        display_name: em.includes("@") ? em.split("@")[0] : em || "Gebruiker",
      })
      .select()
      .maybeSingle();

    if (insErr) {
      const { data: retry } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      resolved = retry as RequestUserProfile | null;
      if (!resolved) {
        console.error("[PROFILE INSERT]", insErr);
        return { ok: false, code: "no_profile_after_insert" };
      }
    } else {
      resolved = newProfile as RequestUserProfile;
    }
  }

  if (!resolved) {
    return { ok: false, code: "no_profile_after_insert" };
  }

  return { ok: true, profile: resolved };
}
