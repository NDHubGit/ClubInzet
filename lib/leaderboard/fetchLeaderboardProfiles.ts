import type { SupabaseClient } from "@supabase/supabase-js";

export type LeaderboardProfileRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Profielen voor klassement-labels (RLS-blokkade omzeild via POST /api/leaderboard/profile-labels).
 *
 * Belangrijk: geen early-return meer als `getSession()` geen access_token heeft — dan faalt de fetch
 * terwijl `getRequestUser` op de server de sessie wél via **cookies** kan valideren (`credentials: "include"`).
 */
export async function fetchLeaderboardProfilesForIds(
  sb: SupabaseClient,
  ids: string[]
): Promise<Map<string, LeaderboardProfileRow>> {
  const uniq = [...new Set(ids.filter(Boolean))].slice(0, 200);
  const m = new Map<string, LeaderboardProfileRow>();
  if (uniq.length === 0) return m;

  let { data: sessionData } = await sb.auth.getSession();
  let token = sessionData.session?.access_token ?? null;
  if (!token) {
    const refreshed = await sb.auth.refreshSession();
    token = refreshed.data.session?.access_token ?? null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch("/api/leaderboard/profile-labels", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ ids: uniq }),
  });
  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      const errBody = await res.clone().text();
      console.warn("[fetchLeaderboardProfilesForIds]", res.status, errBody.slice(0, 200));
    }
    return m;
  }
  const j = (await res.json().catch(() => ({}))) as { profiles?: LeaderboardProfileRow[]; error?: string };
  for (const p of j.profiles ?? []) {
    if (p?.id) m.set(String(p.id), p);
  }
  return m;
}
