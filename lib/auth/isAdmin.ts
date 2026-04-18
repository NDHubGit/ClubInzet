import { adminAuthDebug } from "@/lib/admin/adminAuthDebugLog";
import type { AdminAuthDenyReason } from "@/lib/admin/adminAuthDenyReasons";
import { getAdminClient } from "@/lib/supabase/adminClient";

export type UserAdminVerdict = {
  allowed: boolean;
  denyReason?: AdminAuthDenyReason;
  profileId: string | null;
  profileEmail: string | null;
  roleRaw: string | null;
  rowFound: boolean;
  dbError: string | null;
};

/**
 * Service-role check op `profiles` (RLS omzeilen).
 * Gebruikt door `requireAdminRequest` i.p.v. dubbele query + voor debug deny-codes.
 */
export async function getUserAdminVerdict(userId: string): Promise<UserAdminVerdict> {
  const empty = (): UserAdminVerdict => ({
    allowed: false,
    profileId: null,
    profileEmail: null,
    roleRaw: null,
    rowFound: false,
    dbError: null,
  });

  try {
    const admin = getAdminClient();
    const { data, error } = await admin.from("profiles").select("id, role, email").eq("id", userId).maybeSingle();

    if (error) {
      const v: UserAdminVerdict = {
        ...empty(),
        denyReason: "PROFILE_QUERY_ERROR",
        dbError: error.message,
      };
      adminAuthDebug("isUserAdmin", {
        userId,
        verdict: false,
        denyReason: v.denyReason,
        profileId: null,
        profileEmail: null,
        roleFromDb: null,
        rowFound: false,
        dbError: error.message,
      });
      return v;
    }

    if (data == null) {
      const v: UserAdminVerdict = {
        ...empty(),
        denyReason: "NO_PROFILE_ROW",
      };
      adminAuthDebug("isUserAdmin", {
        userId,
        verdict: false,
        denyReason: v.denyReason,
        profileId: null,
        profileEmail: null,
        roleFromDb: null,
        rowFound: false,
        dbError: null,
      });
      return v;
    }

    const roleRaw = String(data.role ?? "").trim();
    const profileEmail = data.email != null ? String(data.email).trim() : null;
    const profileId = data.id != null ? String(data.id) : null;
    /** Clubbeheer: `profiles.role` moet (na trim, case-insensitive) `admin` zijn. */
    const allowed = roleRaw.toLowerCase() === "admin";
    const v: UserAdminVerdict = {
      allowed,
      denyReason: allowed ? undefined : "PROFILE_NOT_ADMIN",
      profileId,
      profileEmail: profileEmail && profileEmail.length > 0 ? profileEmail : null,
      roleRaw: roleRaw.length > 0 ? roleRaw : null,
      rowFound: true,
      dbError: null,
    };

    adminAuthDebug("isUserAdmin", {
      userId,
      verdict: allowed,
      denyReason: v.denyReason ?? null,
      profileId,
      profileEmail: v.profileEmail,
      roleFromDb: v.roleRaw,
      rowFound: true,
      dbError: null,
    });
    return v;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const v: UserAdminVerdict = {
      ...empty(),
      denyReason: "ADMIN_CHECK_EXCEPTION",
      dbError: msg,
    };
    adminAuthDebug("isUserAdmin", {
      userId,
      verdict: false,
      denyReason: v.denyReason,
      exception: msg,
    });
    return v;
  }
}

/** Backwards-compat: zelfde query als `getUserAdminVerdict`. */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const v = await getUserAdminVerdict(userId);
  return v.allowed;
}
