import type { SupabaseClient } from "@supabase/supabase-js";

import type { TeamRelationType, VolunteerCandidate } from "@/lib/planning/clubTypes";
import { loadAvailabilityBlockedDates } from "@/lib/planning/availabilityDb";

function isNonAdmin(role: string | null | undefined): boolean {
  return String(role ?? "").toLowerCase() !== "admin";
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x));
  }
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw) as unknown;
      return Array.isArray(j) ? j.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Regel A: alleen actieve vrijwilligers, geen admins.
 * Verrijkt met team-koppelingen voor regel B.
 */
export async function buildVolunteerPool(supabase: SupabaseClient): Promise<VolunteerCandidate[]> {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  if (pErr) {
    console.error("[buildVolunteerPool] profiles", pErr);
    throw new Error(`Profielen laden mislukt: ${pErr.message}`);
  }

  const { data: members, error: mErr } = await supabase
    .from("team_members")
    .select("team_id, profile_id, relation_type");

  if (mErr) {
    console.warn("[buildVolunteerPool] team_members (optioneel):", mErr.message);
  }

  const byProfile = new Map<string, { teamIds: Set<string>; rel: Map<string, TeamRelationType> }>();
  for (const row of members || []) {
    const pid = row.profile_id != null ? String(row.profile_id) : null;
    const tid = row.team_id != null ? String(row.team_id) : null;
    if (!pid || !tid) continue;
    const rel = (row.relation_type != null ? String(row.relation_type) : "speler") as TeamRelationType;
    if (!byProfile.has(pid)) {
      byProfile.set(pid, { teamIds: new Set(), rel: new Map() });
    }
    const b = byProfile.get(pid)!;
    b.teamIds.add(tid);
    b.rel.set(tid, rel);
  }

  const out: VolunteerCandidate[] = [];
  for (const p of profiles || []) {
    const row = p as Record<string, unknown>;
    const id = row.id != null ? String(row.id) : "";
    if (!id) continue;
    const role = row.role != null ? String(row.role) : null;
    const active = row.active === undefined ? true : Boolean(row.active);
    if (!active || !isNonAdmin(role)) continue;

    const meta = byProfile.get(id) ?? { teamIds: new Set<string>(), rel: new Map<string, TeamRelationType>() };

    out.push({
      profileId: id,
      displayName:
        (row.display_name != null && String(row.display_name).trim() !== ""
          ? String(row.display_name)
          : null) ||
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        (row.email != null ? String(row.email) : id),
      email: row.email != null ? String(row.email) : null,
      role,
      volunteerType: row.volunteer_type != null ? String(row.volunteer_type) : "algemeen",
      active: true,
      maxTasksPerMonth:
        row.max_tasks_per_month != null && Number.isFinite(Number(row.max_tasks_per_month))
          ? Math.max(0, Math.floor(Number(row.max_tasks_per_month)))
          : 10,
      unavailableDates: parseJsonStringArray(row.unavailable_dates),
      availabilityBlockedDates: new Set(),
      preferredTaskTypes: parseJsonStringArray(row.preferred_tasks),
      teamIds: meta.teamIds,
      relationByTeam: meta.rel,
    });
  }

  const blockedMap = await loadAvailabilityBlockedDates(
    supabase,
    out.map((v) => v.profileId)
  );
  for (const v of out) {
    v.availabilityBlockedDates = blockedMap.get(v.profileId) ?? new Set();
  }

  console.log("[buildVolunteerPool] vrijwilligers in pool:", out.length);
  return out;
}
