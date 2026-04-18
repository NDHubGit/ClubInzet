import { effectiveTaskPoints } from "@/lib/points/effectiveTaskPoints";

export type LeaderboardRow = {
  user_id: string;
  total_points: number;
  total_tasks: number;
};

/**
 * Klassement: goedgekeurde vrijwilligerspunten (assigned_to, status completed/approved).
 */
export function buildLeaderboardFromTasks(allTasks: unknown[] | null | undefined): LeaderboardRow[] {
  const map: Record<string, { user_id: string; totalPoints: number; totalTasks: number }> = {};
  for (const t of allTasks || []) {
    if (!t || typeof t !== "object") continue;
    const row = t as { status?: string | null; assigned_to?: string | null };
    const st = String(row.status || "").toLowerCase();
    if (st !== "completed" && st !== "approved") continue;
    const uid = row.assigned_to != null ? String(row.assigned_to) : "";
    if (!uid) continue;
    const pts = effectiveTaskPoints(row as { points?: unknown; override_points?: unknown | null });
    if (!map[uid]) {
      map[uid] = { user_id: uid, totalPoints: 0, totalTasks: 0 };
    }
    map[uid].totalPoints += pts;
    map[uid].totalTasks += 1;
  }
  return Object.values(map)
    .map((r) => ({
      user_id: r.user_id,
      total_points: Math.round(r.totalPoints * 10) / 10,
      total_tasks: r.totalTasks,
    }))
    .sort((a, b) => b.total_points - a.total_points);
}
