/** Minimaal profiel voor redirect (rol). */
export type ProfileForRedirect = { role?: string | null } | null | undefined;

/** Pad na login op basis van profiel. */
export function pathForProfileRole(profile: ProfileForRedirect): "/login" | "/admin" | "/user" {
  if (!profile) return "/login";

  if (profile.role === "admin") return "/admin";
  return "/user";
}
