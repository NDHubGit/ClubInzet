import type { SupabaseClient } from "@supabase/supabase-js";

import type { MonthlyLoad } from "@/lib/planning/clubTypes";
import { normalizeTaskStatus } from "@/lib/planning/taskStatus";
import { effectiveTaskPoints } from "@/lib/points/volunteerPoints";

function monthRangeIso(year: number, month: number): { start: string; end: string } {
  const m = Math.max(1, Math.min(12, month));
  const lastDay = new Date(year, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Aantal toegewezen taken + punten per profiel in een kalendermaand (task_date).
 */
export async function getMonthlyLoadMap(
  supabase: SupabaseClient,
  profileIds: string[],
  year: number,
  month: number
): Promise<Map<string, MonthlyLoad>> {
  const map = new Map<string, MonthlyLoad>();
  for (const id of profileIds) {
    map.set(id, { taskCount: 0, pointsSum: 0 });
  }
  if (profileIds.length === 0) return map;

  const { start, end } = monthRangeIso(year, month);

  const { data, error } = await supabase
    .from("tasks")
    .select("assigned_to, points, override_points, task_date, status")
    .in("assigned_to", profileIds)
    .gte("task_date", start)
    .lte("task_date", end)
    .not("assigned_to", "is", null);

  if (error) {
    console.warn("[getMonthlyLoadMap]", error.message);
    return map;
  }

  for (const row of data || []) {
    const st = normalizeTaskStatus((row as { status?: string }).status);
    if (
      st === "completed" ||
      st === "approved" ||
      st === "missed" ||
      st === "pending" ||
      st === "rejected"
    ) {
      continue;
    }
    const aid = row.assigned_to != null ? String(row.assigned_to) : null;
    if (!aid || !map.has(aid)) continue;
    const cur = map.get(aid)!;
    cur.taskCount += 1;
    cur.pointsSum += effectiveTaskPoints(row as { points?: unknown; override_points?: unknown | null });
    map.set(aid, cur);
  }

  return map;
}

/**
 * Aantal toegewezen taken per (profiel, team) in een kalendermaand (voor spreiding binnen team).
 */
export async function getMonthlySameTeamTaskCounts(
  supabase: SupabaseClient,
  profileIds: string[],
  year: number,
  month: number
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  for (const id of profileIds) {
    out.set(id, new Map());
  }
  if (profileIds.length === 0) return out;

  const { start, end } = monthRangeIso(year, month);

  const { data, error } = await supabase
    .from("tasks")
    .select("assigned_to, team_id, task_date, status")
    .in("assigned_to", profileIds)
    .gte("task_date", start)
    .lte("task_date", end)
    .not("assigned_to", "is", null)
    .not("team_id", "is", null);

  if (error) {
    console.warn("[getMonthlySameTeamTaskCounts]", error.message);
    return out;
  }

  for (const row of data || []) {
    const st = normalizeTaskStatus((row as { status?: string }).status);
    if (
      st === "completed" ||
      st === "approved" ||
      st === "missed" ||
      st === "pending" ||
      st === "rejected"
    ) {
      continue;
    }
    const aid = row.assigned_to != null ? String(row.assigned_to) : null;
    const tid = row.team_id != null ? String(row.team_id) : null;
    if (!aid || !tid || !out.has(aid)) continue;
    const inner = out.get(aid)!;
    inner.set(tid, (inner.get(tid) ?? 0) + 1);
  }

  return out;
}

/**
 * Laatste taakdatum (YYYY-MM-DD) per profiel waar iemand als assigned_to stond.
 */
export async function getLastAssignedDates(
  supabase: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const id of profileIds) out.set(id, null);
  if (profileIds.length === 0) return out;

  const { data, error } = await supabase
    .from("tasks")
    .select("assigned_to, task_date, status")
    .in("assigned_to", profileIds)
    .not("task_date", "is", null);

  if (error) {
    console.warn("[getLastAssignedDates]", error.message);
    return out;
  }

  for (const row of data || []) {
    const st = normalizeTaskStatus((row as { status?: string }).status);
    if (st === "pending" || st === "rejected") continue;
    const aid = row.assigned_to != null ? String(row.assigned_to) : null;
    const d = row.task_date != null ? String(row.task_date).slice(0, 10) : null;
    if (!aid || !d) continue;
    const prev = out.get(aid);
    if (prev == null || d > prev) out.set(aid, d);
  }

  return out;
}
