import type { User } from "@supabase/supabase-js";

import { DEV_ROLE_HEADER } from "@/lib/dev/fixtureUsers";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/** E-mails van dev testaccounts — moeten in `profiles` bestaan. */
export const DEV_USER_EMAIL = "user1@test.nl";
export const DEV_ADMIN_EMAIL = "admin@test.nl";

export type DevResolvedProfile = {
  id: string;
  email: string;
  role: string;
};

export async function fetchDevProfileByEmail(email: string): Promise<DevResolvedProfile | null> {
  const admin = getSupabaseServiceRole();
  const { data, error } = await admin.from("profiles").select("*").eq("email", email).maybeSingle();
  if (error) {
    console.warn("[fetchDevProfileByEmail]", email, error.message);
    return null;
  }
  if (!data?.id) return null;
  return {
    id: String(data.id),
    email: data.email != null ? String(data.email) : email,
    role: data.role != null ? String(data.role) : "member",
  };
}

export function profileToSupabaseUser(profile: DevResolvedProfile): User {
  return {
    id: profile.id,
    email: profile.email,
    aud: "authenticated",
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    role: "authenticated",
  } as User;
}

/** Dev API-auth: profiel uit DB, geen vaste UUID. */
export async function resolveDevUserFromRole(
  role: "user" | "admin"
): Promise<{ user: User; profile: DevResolvedProfile } | null> {
  const email = role === "admin" ? DEV_ADMIN_EMAIL : DEV_USER_EMAIL;
  const profile = await fetchDevProfileByEmail(email);
  if (!profile) {
    console.warn("[resolveDevUserFromRole] geen profiel voor", email);
    return null;
  }
  const user = profileToSupabaseUser(profile);
  console.log("USER ID:", user.id);
  return { user, profile };
}

/** Actor-id voor /api/dev/data (home/admin) — zelfde bron als getRequestUser. */
export async function getDevActorIdFromRequest(request: Request): Promise<string | null> {
  const role = request.headers.get(DEV_ROLE_HEADER)?.toLowerCase();
  if (role !== "user" && role !== "admin") return null;
  const email = role === "admin" ? DEV_ADMIN_EMAIL : DEV_USER_EMAIL;
  const p = await fetchDevProfileByEmail(email);
  return p?.id ?? null;
}
