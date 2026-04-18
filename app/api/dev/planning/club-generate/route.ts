import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { applyClubPlanningAssignments } from "@/lib/planning/applyClubPlanning";
import { buildVolunteerPool } from "@/lib/planning/buildVolunteerPool";
import {
  generateClubPlanning,
  planningMonthFromTasks,
  rowsToClubTasks,
} from "@/lib/planning/generateClubPlanning";
import {
  getLastAssignedDates,
  getMonthlyLoadMap,
  getMonthlySameTeamTaskCounts,
} from "@/lib/planning/getMonthlyLoad";
import { getVolunteerPointsMap } from "@/lib/points/volunteerPoints";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Development-only: clubplanning-engine (regels A–G) op alle open taken.
 */
export async function POST() {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  try {
    const volunteers = await buildVolunteerPool(admin);
    const [{ data: taskRows, error: tErr }, { data: teamRows }] = await Promise.all([
      admin.from("tasks").select("*").order("task_date", { ascending: true }),
      admin.from("teams").select("id, category"),
    ]);
    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    const catMap = new Map<string, string | null>(
      (teamRows || []).map((t: { id: string; category: string | null }) => [String(t.id), t.category])
    );
    const tasks = rowsToClubTasks(taskRows || []).map((t) => ({
      ...t,
      team_category: t.team_id ? catMap.get(String(t.team_id)) ?? null : null,
    }));
    const { year, month } = planningMonthFromTasks(tasks);
    const ids = volunteers.map((v) => v.profileId);
    const monthlyLoad = await getMonthlyLoadMap(admin, ids, year, month);
    const monthlySameTeam = await getMonthlySameTeamTaskCounts(admin, ids, year, month);
    const lastAssigned = await getLastAssignedDates(admin, ids);
    const volunteerApprovedPoints = await getVolunteerPointsMap(admin, ids);

    const outcome = generateClubPlanning(
      tasks,
      volunteers,
      monthlyLoad,
      lastAssigned,
      monthlySameTeam,
      volunteerApprovedPoints
    );
    // Geen bulk-mail bij dev club-generate (veel taken); zet sendAssignmentEmails: true om te testen.
    const applied = await applyClubPlanningAssignments(admin, outcome.assignments, {
      sendAssignmentEmails: false,
    });

    return NextResponse.json({
      outcome,
      applied,
      planningMonth: { year, month },
    });
  } catch (e) {
    console.error("[api/dev/planning/club-generate]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
