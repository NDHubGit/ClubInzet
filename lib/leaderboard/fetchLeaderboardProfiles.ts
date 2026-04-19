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
 */
export async function fetchLeaderboardProfilesForIds(
  sb: SupabaseClient,
  ids: string[]
): Promise<Map<string, LeaderboardProfileRow>> {
  const uniq = [...new Set(ids.filter(Boolean))].slice(0, 200);
  const m = new Map<string, LeaderboardProfileRow>();
  if (uniq.length === 0) return m;

  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return m;

  const res = await fetch("/api/leaderboard/profile-labels", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids: uniq }),
  });
  if (!res.ok) return m;
  const j = (await res.json().catch(() => ({}))) as { profiles?: LeaderboardProfileRow[] };
  for (const p of j.profiles ?? []) {
    if (p?.id) m.set(String(p.id), p);
  }
  return m;
}
