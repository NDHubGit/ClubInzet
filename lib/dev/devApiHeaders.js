import { DEV_ROLE_HEADER } from "@/lib/dev/fixtureUsers";
import { getDevRole } from "@/lib/dev/devRole";

/**
 * Voegt development-rol toe aan API-calls zodat de server `getRequestUser` kan resolven zonder JWT.
 * @param {Record<string, string>} [extra]
 * @param {{ role?: 'admin' | 'user' }} [opts] — override (bijv. Mijn-taken-pagina forceert altijd `user`).
 */
export function getDevApiHeaders(extra, opts) {
  const base = extra && typeof extra === "object" ? { ...extra } : {};
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return base;
  }
  const role = opts?.role ?? getDevRole();
  return {
    ...base,
    [DEV_ROLE_HEADER]: role,
  };
}
