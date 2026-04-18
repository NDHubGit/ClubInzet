import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Laadt datums waarop user_id expliciet `available = false` heeft in availability.
 */
export async function loadAvailabilityBlockedDates(
  supabase: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const id of profileIds) out.set(id, new Set());
  if (profileIds.length === 0) return out;

  const { data, error } = await supabase
    .from("availability")
    .select("user_id, date, available")
    .in("user_id", profileIds)
    .eq("available", false);

  if (error) {
    console.warn("[loadAvailabilityBlockedDates]", error.message);
    return out;
  }

  for (const row of data || []) {
    const uid = row.user_id != null ? String(row.user_id) : null;
    const d = row.date != null ? String(row.date).slice(0, 10) : null;
    if (!uid || !d || !out.has(uid)) continue;
    out.get(uid)!.add(d);
  }

  return out;
}

/** Synchrone check op vooraf geladen set (default beschikbaar = geen rij of available true). */
export function isUserAvailableOnDate(blocked: Set<string> | undefined, dateIso: string): boolean {
  if (!blocked || blocked.size === 0) return true;
  return !blocked.has(dateIso.slice(0, 10));
}
