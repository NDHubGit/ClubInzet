/**
 * Weergavenamen voor UI: nooit volledige e-mail tonen voor andere gebruikers.
 * `email` mag intern gebruikt worden om een prefix (voor @) af te leiden.
 */

import { displayNameForProfile } from "@/lib/admin/aggregateMembers";

export type ProfileLike = {
  id?: string | null;
  /** Optioneel apart veld; anders display_name / e-mailprefix */
  name?: string | null;
  display_name?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function capitalizeFirst(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Publieke naamregel zonder volledig e-mailadres (prefix uit profile.email is toegestaan als fallback). */
export function resolveProfilePublicName(profile: ProfileLike | null | undefined): string {
  if (!profile) return "Gebruiker";

  const explicitName = profile.name?.trim();
  if (explicitName) return capitalizeFirst(explicitName);

  const dn = profile.display_name?.trim();
  if (dn) return capitalizeFirst(dn);

  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (full) return capitalizeFirst(full);

  const em = profile.email;
  if (em && String(em).includes("@")) {
    return capitalizeFirst(String(em).split("@")[0]);
  }

  return "Gebruiker";
}

/**
 * Toonlabel voor lijsten / klassement.
 * Zelf: `"Naam (jij)"`, anderen: alleen naam (geen e-mail).
 */
export function getDisplayName(
  profile: ProfileLike | null | undefined,
  currentUserId: string | null | undefined
): string {
  const base = resolveProfilePublicName(profile);
  if (
    profile?.id != null &&
    currentUserId != null &&
    String(profile.id) === String(currentUserId)
  ) {
    return `${base} (jij)`;
  }
  return base;
}

/** Alleen voor legacy: één display_name-string. Gebruik bij voorkeur resolveProfilePublicName. */
export function publicProfileLabel(displayName: string | null | undefined): string {
  const d = displayName?.trim();
  return d ? capitalizeFirst(d) : "Gebruiker";
}

/**
 * Klassement / leaderboard: zelfde prioriteit als admin-ledenexport (`displayNameForProfile`).
 * Fallback “Gebruiker” i.p.v. “Onbekend” voor consistentie met de rest van de app.
 */
export function leaderboardParticipantName(
  profile: ProfileLike | null | undefined,
  currentUserId: string | null | undefined
): string {
  const raw = displayNameForProfile({
    id: String(profile?.id ?? ""),
    email: profile?.email ?? null,
    name: profile?.name ?? null,
    display_name: profile?.display_name ?? null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
  });
  const base = raw === "Onbekend" ? "Gebruiker" : raw;
  if (
    profile?.id != null &&
    currentUserId != null &&
    String(profile.id) === String(currentUserId)
  ) {
    return `${base} (jij)`;
  }
  return base;
}
