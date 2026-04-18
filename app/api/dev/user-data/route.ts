import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { DEV_USER_EMAIL, fetchDevProfileByEmail } from "@/lib/dev/resolveDevProfile";
import { getUserVolunteerPoints } from "@/lib/points/volunteerPoints";
import { normalizeTaskStatus } from "@/lib/planning/taskStatus";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Development zonder Auth: alle data voor /user (service role), altijd voor user1-fixture.
 */
export async function GET() {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const profile = await fetchDevProfileByEmail(DEV_USER_EMAIL);
  if (!profile?.id) {
    return NextResponse.json(
      { error: `Geen profiel voor ${DEV_USER_EMAIL} — seed of fixture users aanmaken.` },
      { status: 404 }
    );
  }
  const uid = profile.id;
  const admin = getSupabaseServiceRole();

  const [mine, open] = await Promise.all([
    admin
      .from("tasks")
      .select(
        "id, title, task_type, task_date, planning_explanation, status, source, description, points, override_points, team_id"
      )
      .eq("assigned_to", uid)
      .order("task_date", { ascending: true }),
    admin
      .from("tasks")
      .select("id, title, task_type, task_date, planning_explanation, team_id")
      .in("status", ["planned", "open"])
      .is("assigned_to", null)
      .order("task_date", { ascending: true }),
  ]);

  const err = mine.error || open.error;
  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const mineRows = mine.data ?? [];
  const volunteerPoints = await getUserVolunteerPoints(admin, uid);

  const openRows = open.data ?? [];

  return NextResponse.json({
    geplandTasks: mineRows.filter(
      (r) =>
        normalizeTaskStatus(String(r.status ?? "")) === "claimed" && String(r.source ?? "planned") !== "manual"
    ),
    manualTasks: mineRows.filter((r) => String(r.source ?? "") === "manual"),
    openTasks: openRows,
    flowEvents: [],
    teamsPick: [],
    volunteerPoints,
  });
}
