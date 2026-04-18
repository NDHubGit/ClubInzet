/**
 * Server-side deny-codes voor admin-auth (alleen gelogd, niet in client-JSON).
 * Gebruikt met CLUBINZET_DEBUG_ADMIN_AUTH=1.
 */
export type AdminAuthDenyReason =
  | "SERVICE_ROLE_MISSING"
  | "NO_AUTH_USER"
  | "BEARER_INVALID"
  | "BEARER_EMPTY_OR_UNPARSABLE"
  | "MISSING_PUBLIC_SUPABASE_ENV"
  | "NO_COOKIE_SESSION"
  | "COOKIE_GETUSER_FAILED"
  | "PROFILE_QUERY_ERROR"
  | "NO_PROFILE_ROW"
  | "PROFILE_NOT_ADMIN"
  | "ADMIN_CHECK_EXCEPTION"
  | "UNKNOWN";
