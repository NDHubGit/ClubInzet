import { NextResponse } from "next/server";

import { adminAuthDebug } from "@/lib/admin/adminAuthDebugLog";
import type { AdminAuthDenyReason } from "@/lib/admin/adminAuthDenyReasons";
import { authenticateRequest } from "@/lib/auth/getRequestUser";
import { getUserAdminVerdict } from "@/lib/auth/isAdmin";
import { getAdminServerConfigError } from "@/lib/supabase/adminClient";

export type AdminAuthOk = { ok: true; userId: string };
export type AdminAuthFail = { ok: false; response: NextResponse };

function resolveRouteLabel(request: Request, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  try {
    return new URL(request.url).pathname;
  } catch {
    return "?";
  }
}

function noAuthDenyReason(meta: { denyReason?: AdminAuthDenyReason }): AdminAuthDenyReason {
  const r = meta.denyReason;
  if (r === "BEARER_INVALID" || r === "BEARER_EMPTY_OR_UNPARSABLE" || r === "MISSING_PUBLIC_SUPABASE_ENV") {
    return r;
  }
  return "NO_AUTH_USER";
}

/**
 * Gedeelde admin-check voor API-routes (Bearer vóór cookies via `authenticateRequest`).
 *
 * @param debugRouteLabel Optioneel label in debug-logs (anders: pad uit request.url).
 */
export async function requireAdminRequest(
  request: Request,
  debugRouteLabel?: string
): Promise<AdminAuthOk | AdminAuthFail> {
  const label = resolveRouteLabel(request, debugRouteLabel);

  const missingCfg = getAdminServerConfigError();
  if (missingCfg) {
    console.error("[requireAdminRequest] ADMIN_SERVER_CONFIG", missingCfg);
    adminAuthDebug("requireAdminRequest", {
      route: label,
      finalResult: "deny",
      denyReason: "SERVICE_ROLE_MISSING" as AdminAuthDenyReason,
      detail: missingCfg,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "ADMIN_SERVER_CONFIG", message: missingCfg },
        { status: 503 }
      ),
    };
  }

  try {
    const { auth, meta } = await authenticateRequest(request);
    if (!auth) {
      const denyReason = noAuthDenyReason(meta);
      adminAuthDebug("requireAdminRequest", {
        route: label,
        finalResult: "deny",
        denyReason,
        authSource: meta.authSource,
        path: meta.path,
        method: meta.method,
        hasAuthHeader: meta.hasAuthHeader,
        bearerTokenParsed: meta.bearerTokenParsed,
        httpStatus: 401,
      });
      return { ok: false, response: NextResponse.json({ error: "Niet ingelogd" }, { status: 401 }) };
    }

    const verdict = await getUserAdminVerdict(auth.user.id);
    if (!verdict.allowed) {
      adminAuthDebug("requireAdminRequest", {
        route: label,
        finalResult: "deny",
        denyReason: verdict.denyReason ?? "UNKNOWN",
        authSource: meta.authSource,
        path: meta.path,
        method: meta.method,
        authenticatedUserId: auth.user.id,
        userEmail: meta.userEmail,
        profileRoleFromJwtContext: meta.profileRoleFromContext,
        serviceRoleProfileId: verdict.profileId,
        serviceRoleProfileEmail: verdict.profileEmail,
        serviceRoleRoleRaw: verdict.roleRaw,
        serviceRoleRowFound: verdict.rowFound,
        serviceRoleDbError: verdict.dbError,
        httpStatus: 403,
      });
      return {
        ok: false,
        response: NextResponse.json({ error: "ADMIN_AUTH_FORBIDDEN", message: "Geen adminrechten." }, { status: 403 }),
      };
    }

    adminAuthDebug("requireAdminRequest", {
      route: label,
      finalResult: "allow",
      denyReason: null,
      authSource: meta.authSource,
      path: meta.path,
      method: meta.method,
      authenticatedUserId: auth.user.id,
      userEmail: meta.userEmail,
      isUserAdmin: true,
      httpStatus: 200,
    });
    return { ok: true, userId: auth.user.id };
  } catch (e) {
    console.error("[requireAdminRequest] onverwacht", e);
    adminAuthDebug("requireAdminRequest", {
      route: label,
      finalResult: "deny",
      denyReason: "UNKNOWN",
      detail: e instanceof Error ? e.message : String(e),
      httpStatus: 500,
    });
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "ADMIN_AUTH_CHECK_FAILED",
          message: e instanceof Error ? e.message : String(e),
        },
        { status: 500 }
      ),
    };
  }
}
