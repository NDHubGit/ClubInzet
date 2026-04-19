import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { RequestUserProfile } from "@/lib/auth/getRequestUser";

/** Exact deze gebruiker krijgt admin bij nieuwe profiel-aanmaak (herstelpad). */
const ADMIN_EMAIL_EXACT = "nathan@doodkorte.com";

export function defaultRoleForEmail(email: string | null | undefined): string {
  const e = String(email ?? "")
    .trim()
    .toLowerCase();
  return e === ADMIN_EMAIL_EXACT ? "admin" : "user";
}

export function defaultDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full = meta?.full_name;
  const name = meta?.name;
  const fromMeta =
    typeof full === "string" && full.trim()
      ? full.trim()
      : typeof name === "string" && name.trim()
        ? name.trim()
        : null;
  if (fromMeta) return fromMeta;
  const email = user.email ?? "";
  if (email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    return local || "Gebruiker";
  }
  return email.trim() || "Gebruiker";
}

export type TryClientProfileResult = {
  profile: RequestUserProfile | null;
  selectError: { message: string; code?: string } | null;
  insertError: { message: string; code?: string } | null;
};

/** PostgREST: geen enkele rij bij `.single()` */
function isNoRowSingleError(err: { code?: string } | null | undefined): boolean {
  return err?.code === "PGRST116";
}

/**
 * Client/anon Supabase: eigen profiel lezen of aanmaken (RLS).
 * Gebruikt `.single()` voor de hoofd-SELECT (exact één rij verwacht).
 * Geen server-only imports — veilig in client bundles.
 */
export async function tryClientSelectInsertProfile(
  supabase: SupabaseClient,
  user: User
): Promise<TryClientProfileResult> {
  const { data: profile, error: selErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (selErr && !isNoRowSingleError(selErr)) {
    console.error("[tryClientSelectInsertProfile] SELECT failed", {
      message: selErr.message,
      code: selErr.code,
      details: (selErr as { details?: string }).details,
      hint: (selErr as { hint?: string }).hint,
      userId: user.id,
    });
    return { profile: null, selectError: { message: selErr.message, code: selErr.code }, insertError: null };
  }

  if (profile && !selErr) {
    const p = profile as RequestUserProfile;
    if (String(p.id) !== String(user.id)) {
      console.error("[tryClientSelectInsertProfile] PROFILE ID MISMATCH", {
        userId: user.id,
        profileId: p.id,
      });
      return { profile: null, selectError: { message: "profile_id_mismatch" }, insertError: null };
    }
    return { profile: p, selectError: null, insertError: null };
  }

  const em = user.email ?? "";
  const { data: newProfile, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: em || null,
      role: defaultRoleForEmail(em),
      display_name: defaultDisplayName(user),
    })
    .select("*")
    .maybeSingle();

  if (!insErr && newProfile) {
    return { profile: newProfile as RequestUserProfile, selectError: null, insertError: null };
  }

  if (insErr) {
    console.error("[tryClientSelectInsertProfile] INSERT failed", {
      message: insErr.message,
      code: insErr.code,
      userId: user.id,
    });
    const { data: retry, error: retryErr } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (retryErr && !isNoRowSingleError(retryErr)) {
      console.error("[tryClientSelectInsertProfile] retry SELECT failed", { message: retryErr.message, code: retryErr.code });
    }
    if (retry) {
      const p = retry as RequestUserProfile;
      if (String(p.id) === String(user.id)) {
        return { profile: p, selectError: null, insertError: null };
      }
    }
    return {
      profile: null,
      selectError: null,
      insertError: { message: insErr.message, code: insErr.code },
    };
  }

  return { profile: null, selectError: null, insertError: null };
}
