import { adminAuthDebug } from "@/lib/admin/adminAuthDebugLog";
import { bearerFromRequest } from "@/lib/auth/getUserFromBearer";

export type AdminGateSnapshot = { ok: true; userId: string } | { ok: false; response: Response };

/** Entry-log per admin-route bij `CLUBINZET_DEBUG_ADMIN_AUTH=1` vóór de gate. */
export function debugAdminRouteIncoming(request: Request, routeId: string): void {
  let path = "?";
  try {
    path = new URL(request.url).pathname;
  } catch {
    /* ignore */
  }
  adminAuthDebug(routeId, {
    phase: "incoming",
    path,
    method: request.method || "GET",
    hasAuthHeader: Boolean(request.headers.get("authorization")?.trim()),
    hasBearerToken: Boolean(bearerFromRequest(request)),
  });
}

export function debugAdminRouteGateOutcome(routeId: string, gate: AdminGateSnapshot): void {
  if (gate.ok) {
    adminAuthDebug(routeId, { phase: "post-gate", gate: "allow", userId: gate.userId });
  } else {
    adminAuthDebug(routeId, {
      phase: "post-gate",
      gate: "deny",
      httpStatus: gate.response.status,
    });
  }
}
