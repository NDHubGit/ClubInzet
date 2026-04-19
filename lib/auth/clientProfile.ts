import type { SupabaseClient } from "@supabase/supabase-js";

import type { RequestUserProfile } from "@/lib/auth/getRequestUser";
import { tryClientSelectInsertProfile } from "@/lib/auth/profileShared";

const PROFILE_FLOW = "[ClubInzet profile-flow]";

export type FetchOrCreateClientProfileResult =
  | { ok: true; profile: RequestUserProfile }
  | {
      ok: false;
      code: "no_user" | "select_error" | "no_profile_after_insert";
      detail?: string;
    };

function formatSelectError(detail: string, code?: string): string {
  const parts = [detail.trim(), code ? `(code: ${code})` : ""].filter(Boolean);
  return parts.join(" ");
}

/**
 * Browser: alleen `createBrowserClient`-sessie — profiel via RLS met actieve JWT.
 * Geen server-fetch / geen service-role-herstel (dat maskeerde ontbrekende sessie).
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
    console.warn(PROFILE_FLOW, "getUser failed → no_user", {
      logUserPrefix,
      error: userErr?.message,
    });
    return { ok: false, code: "no_user" };
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  const hasSession = Boolean(sessionData.session);
  const hasAccessToken = Boolean(sessionData.session?.access_token);

  console.info(PROFILE_FLOW, "authenticated user + session", {
    logUserPrefix,
    userId: user.id,
    email: user.email ?? null,
    hasSession,
    hasAccessToken,
    sessionError: sessionErr?.message ?? null,
  });

  if (!hasSession) {
    const refreshed = await supabase.auth.refreshSession();
    console.info(PROFILE_FLOW, "refreshSession na ontbrekende sessie", {
      hasSessionAfter: Boolean(refreshed.data.session),
      error: refreshed.error?.message,
    });
  }

  console.info(PROFILE_FLOW, "profile query start (browser client + JWT)", { userId: user.id });
  const attempt = await tryClientSelectInsertProfile(supabase, user);

  if (attempt.profile) {
    console.info(PROFILE_FLOW, "profile query ok", {
      userId: user.id,
      profileId: attempt.profile.id,
    });
    return { ok: true, profile: attempt.profile };
  }

  if (attempt.selectError?.message === "profile_id_mismatch") {
    return {
      ok: false,
      code: "select_error",
      detail: "Profiel hoort niet bij dit account. Neem contact op met de beheerder.",
    };
  }

  if (attempt.selectError) {
    console.error(PROFILE_FLOW, "profile query failed", {
      userId: user.id,
      message: attempt.selectError.message,
      code: attempt.selectError.code,
    });
    return {
      ok: false,
      code: "select_error",
      detail: formatSelectError(attempt.selectError.message, attempt.selectError.code),
    };
  }

  if (attempt.insertError) {
    console.error(PROFILE_FLOW, "profile insert failed", {
      userId: user.id,
      message: attempt.insertError.message,
      code: attempt.insertError.code,
    });
    return {
      ok: false,
      code: "no_profile_after_insert",
      detail: formatSelectError(attempt.insertError.message, attempt.insertError.code),
    };
  }

  return { ok: false, code: "no_profile_after_insert", detail: "Geen profiel na insert." };
}
