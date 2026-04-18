import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import { adminAuthDebug } from "@/lib/admin/adminAuthDebugLog";
import type { AdminAuthDenyReason } from "@/lib/admin/adminAuthDenyReasons";
import { bearerFromRequest, getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { createServerClient } from "@/lib/supabase/server";

/** Profiel uit `profiles` (verse query per request). */
export type RequestUserProfile = {
  id: string;
  email?: string | null;
  role?: string | null;
} & Record<string, unknown>;

export type GetRequestUserResult = { user: User; profile: RequestUserProfile | null };

export type RequestAuthenticationMeta = {
  path: string;
  method: string;
  hasAuthHeader: boolean;
  bearerHeaderScheme: boolean;
  bearerTokenParsed: boolean;
  authSource: "bearer" | "cookies" | "none";
  outcome: "ok" | "reject";
  authenticatedUserId: string | null;
  userEmail: string | null;
  profileId: string | null;
  profileRoleFromContext: string | null;
  denyReason?: AdminAuthDenyReason;
};

async function fetchOrCreateProfile(supabase: SupabaseClient, user: User): Promise<GetRequestUserResult> {
  const { data: profile, error: selErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    console.error("PROFILE ERROR", selErr);
    return { user, profile: null };
  }

  if (profile) {
    console.log("[USER]", user.id);
    console.log("[PROFILE]", profile);
    return { user, profile: profile as RequestUserProfile };
  }

  console.warn("No profile found → creating one");

  const email = user.email ?? "";
  const { data: newProfile, error: insErr } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: email || null,
      role: "user",
      display_name: email.includes("@") ? email.split("@")[0] : email || "Gebruiker",
    })
    .select()
    .maybeSingle();

  if (insErr) {
    const { data: retry } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (retry) {
      console.log("[USER]", user.id);
      console.log("[PROFILE]", retry);
      return { user, profile: retry as RequestUserProfile };
    }
    console.error("PROFILE INSERT ERROR", insErr);
    return { user, profile: null };
  }

  console.log("[USER]", user.id);
  console.log("[PROFILE]", newProfile);
  return { user, profile: newProfile as RequestUserProfile };
}

function requestPathAndMethod(request?: Request): { path: string; method: string } {
  if (!request) return { path: "(no-request)", method: "?" };
  try {
    return { path: new URL(request.url).pathname, method: request.method || "GET" };
  } catch {
    return { path: "(bad-url)", method: request.method || "?" };
  }
}

/**
 * Volledige auth-resolutie + metadata voor debug / requireAdminRequest.
 * Bearer eerst (geldig token); bij expliciete Bearer-header maar ongeldig token → geen cookie-fallback.
 */
export async function authenticateRequest(request?: Request): Promise<{
  auth: GetRequestUserResult | null;
  meta: RequestAuthenticationMeta;
}> {
  const { path, method } = requestPathAndMethod(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeaderRaw = request?.headers.get("authorization");
  const hasAuthHeader = Boolean(authHeaderRaw?.trim());
  const bearerHeaderScheme = Boolean(authHeaderRaw?.trim().toLowerCase().startsWith("bearer"));
  const bearerToken = request ? bearerFromRequest(request) : null;
  const bearerTokenParsed = Boolean(bearerToken);

  const baseMeta = (): Omit<RequestAuthenticationMeta, "outcome"> => ({
    path,
    method,
    hasAuthHeader,
    bearerHeaderScheme,
    bearerTokenParsed,
    authSource: "none",
    authenticatedUserId: null,
    userEmail: null,
    profileId: null,
    profileRoleFromContext: null,
  });

  if (bearerToken && url && anon) {
    const { user, error: bearerErr } = await getUserFromBearer(bearerToken);
    if (user && !bearerErr) {
      const supabaseBearer = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      });
      const out = await fetchOrCreateProfile(supabaseBearer, user);
      const meta: RequestAuthenticationMeta = {
        ...baseMeta(),
        authSource: "bearer",
        outcome: "ok",
        authenticatedUserId: user.id,
        userEmail: user.email ?? null,
        profileId: out.profile?.id ?? null,
        profileRoleFromContext:
          out.profile?.role != null && String(out.profile.role).trim() !== ""
            ? String(out.profile.role)
            : null,
      };
      adminAuthDebug("getRequestUser", { ...meta });
      return { auth: out, meta };
    }
    const meta: RequestAuthenticationMeta = {
      ...baseMeta(),
      authSource: "bearer",
      outcome: "reject",
      denyReason: "BEARER_INVALID",
    };
    adminAuthDebug("getRequestUser", {
      ...meta,
      bearerError: bearerErr ?? "no user",
    });
    return { auth: null, meta };
  }

  if (bearerHeaderScheme && (!bearerTokenParsed || !url || !anon)) {
    const denyReason: AdminAuthDenyReason = !url || !anon ? "MISSING_PUBLIC_SUPABASE_ENV" : "BEARER_EMPTY_OR_UNPARSABLE";
    const meta: RequestAuthenticationMeta = {
      ...baseMeta(),
      authSource: "bearer",
      outcome: "reject",
      denyReason,
    };
    adminAuthDebug("getRequestUser", { ...meta, detail: !url || !anon ? "NEXT_PUBLIC url/anon" : "empty token" });
    return { auth: null, meta };
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      const meta: RequestAuthenticationMeta = {
        ...baseMeta(),
        authSource: "cookies",
        outcome: "reject",
        denyReason: userError ? "COOKIE_GETUSER_FAILED" : "NO_COOKIE_SESSION",
      };
      adminAuthDebug("getRequestUser", { ...meta, getUserError: userError?.message ?? null });
      return { auth: null, meta };
    }
    const out = await fetchOrCreateProfile(supabase, user);
    const meta: RequestAuthenticationMeta = {
      ...baseMeta(),
      authSource: "cookies",
      outcome: "ok",
      authenticatedUserId: user.id,
      userEmail: user.email ?? null,
      profileId: out.profile?.id ?? null,
      profileRoleFromContext:
        out.profile?.role != null && String(out.profile.role).trim() !== ""
          ? String(out.profile.role)
          : null,
    };
    adminAuthDebug("getRequestUser", { ...meta });
    return { auth: out, meta };
  } catch (e) {
    const meta: RequestAuthenticationMeta = {
      ...baseMeta(),
      authSource: "cookies",
      outcome: "reject",
      denyReason: "UNKNOWN",
    };
    adminAuthDebug("getRequestUser", {
      ...meta,
      exception: e instanceof Error ? e.message : String(e),
    });
    return { auth: null, meta };
  }
}

/** Zelfde als `authenticateRequest` maar alleen het resultaat (bestaande API). */
export async function getRequestUser(request?: Request): Promise<GetRequestUserResult | null> {
  const { auth } = await authenticateRequest(request);
  return auth;
}
