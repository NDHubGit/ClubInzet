import type { SupabaseClient } from "@supabase/supabase-js";

import { calculatePoints } from "@/lib/points/calculatePoints";

/** Drempel: ≥ dit aantal goedgekeurde punten → minder prioriteit in planning + badge in UI. */
export const VOLUNTEER_QUOTA_POINTS = 50;

export { effectiveTaskPoints } from "./effectiveTaskPoints";

/**
 * Som van effectieve punten voor goedgekeurde taken (status approved / completed) per vrijwilliger.
 */
export async function getUserVolunteerPoints(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("tasks")
    .select("points, override_points, status")
    .eq("assigned_to", userId);

  if (error) {
    console.warn("[getUserVolunteerPoints]", error.message);
    return 0;
  }

  return calculatePoints(data || []);
}

/**
 * Batch: punten per profiel-id (alleen status approved / completed).
 */
export async function getVolunteerPointsMap(
  supabase: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of profileIds) map.set(id, 0);
  if (profileIds.length === 0) return map;

  const { data, error } = await supabase.from("tasks").select("assigned_to, points, override_points, status").in("assigned_to", profileIds);

  if (error) {
    console.warn("[getVolunteerPointsMap]", error.message);
    return map;
  }

  const byUser = new Map<string, typeof data>();
  for (const row of data || []) {
    const aid = (row as { assigned_to?: string | null }).assigned_to;
    if (aid == null) continue;
    const k = String(aid);
    if (!map.has(k)) continue;
    const list = byUser.get(k) ?? [];
    list.push(row);
    byUser.set(k, list);
  }

  for (const k of map.keys()) {
    map.set(k, calculatePoints(byUser.get(k) ?? []));
  }
  return map;
}
