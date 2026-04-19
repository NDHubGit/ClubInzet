import "server-only";

import type { User } from "@supabase/supabase-js";

import type { RequestUserProfile } from "@/lib/auth/getRequestUser";
import { defaultDisplayName, defaultRoleForEmail } from "@/lib/auth/profileShared";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Service role: profiel ophalen of aanmaken (bypass RLS). Alleen server / API-routes.
 */
export async function ensureProfileWithServiceRole(user: User): Promise<{
  profile: RequestUserProfile | null;
  error: string | null;
}> {
  const admin = getSupabaseServiceRole();

  const { data: existing, error: selErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    console.error("[ensureProfileWithServiceRole] service SELECT failed", {
      message: selErr.message,
      code: selErr.code,
      userId: user.id,
    });
    return { profile: null, error: selErr.message };
  }

  if (existing) {
    const p = existing as RequestUserProfile;
    if (String(p.id) !== String(user.id)) {
      console.error("[ensureProfileWithServiceRole] PROFILE ID MISMATCH", {
        userId: user.id,
        profileId: p.id,
      });
      return { profile: null, error: "Profiel-ID komt niet overeen met dit account." };
    }
    return { profile: p, error: null };
  }

  const payload = {
    id: user.id,
    email: user.email ?? null,
    role: defaultRoleForEmail(user.email),
    display_name: defaultDisplayName(user),
  };

  const { data: inserted, error: insErr } = await admin.from("profiles").insert(payload).select("*").maybeSingle();

  if (!insErr && inserted) {
    return { profile: inserted as RequestUserProfile, error: null };
  }

  if (insErr) {
    const isDup = String(insErr.code) === "23505" || insErr.message.toLowerCase().includes("duplicate");
    console.error("[ensureProfileWithServiceRole] INSERT failed", {
      message: insErr.message,
      code: insErr.code,
      userId: user.id,
      isDuplicate: isDup,
    });
    const { data: retry } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (retry) {
      return { profile: retry as RequestUserProfile, error: null };
    }
    return { profile: null, error: insErr.message };
  }

  return { profile: null, error: "Onbekende fout bij profiel." };
}
