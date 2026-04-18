import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { ensureDevTestUsers } from "@/lib/dev/ensureDevTestUsers";
import { ensureFixtureAuthUsers } from "@/lib/dev/ensureFixtureAuthUsers";
import { DEV_USER1_ID } from "@/lib/dev/fixtureUsers";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Development-only: test-users (auth + profiles), teams + pool-taken.
 */
export async function POST() {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  const { warnings: fixtureWarnings } = await ensureFixtureAuthUsers();
  const { ids: testUserIds, warnings: userWarnings } = await ensureDevTestUsers(admin);

  let poolUserId = testUserIds.find((id) => id === DEV_USER1_ID) ?? testUserIds[0] ?? null;
  if (!poolUserId) {
    const { data: prof } = await admin.from("profiles").select("id").eq("id", DEV_USER1_ID).maybeSingle();
    poolUserId = prof?.id ?? null;
  }
  if (!poolUserId) {
    const { data: prof } = await admin.from("profiles").select("id").limit(1).maybeSingle();
    poolUserId = prof?.id ?? null;
  }

  if (!poolUserId) {
    return NextResponse.json(
      {
        error:
          "Geen gebruikers/profielen — controleer of signUp voor testaccounts mag (Auth settings) en of RLS inserts toestaat.",
        userWarnings,
      },
      { status: 400 }
    );
  }

  const taskDate = new Date().toISOString().slice(0, 10);

  const teamPayload = [{ name: "Team A" }, { name: "Team B" }];
  const { data: teamsInserted, error: teamsErr } = await admin.from("teams").insert(teamPayload).select("id,name");

  let teamAId = teamsInserted?.[0]?.id ?? null;
  let teamBId = teamsInserted?.[1]?.id ?? null;

  if (teamsErr) {
    const { data: existingTeams } = await admin.from("teams").select("id,name").order("name");
    if (Array.isArray(existingTeams)) {
      const a = existingTeams.find((t) => t.name === "Team A");
      const b = existingTeams.find((t) => t.name === "Team B");
      teamAId = a?.id ?? null;
      teamBId = b?.id ?? null;
    }
  }

  const taskRows = [
    {
      user_id: poolUserId,
      task_type: "Club dienst",
      duration_minutes: 60,
      points: 1,
      flagged: false,
      title: "Bardienst zaterdag",
      task_date: taskDate,
      assigned_to: null,
      team_id: teamAId,
      notification_sent: false,
    },
    {
      user_id: poolUserId,
      task_type: "Club dienst",
      duration_minutes: 90,
      points: 1.5,
      flagged: false,
      title: "Training dinsdag",
      task_date: taskDate,
      assigned_to: null,
      team_id: teamBId,
      notification_sent: false,
    },
    {
      user_id: poolUserId,
      task_type: "Club dienst",
      duration_minutes: 120,
      points: 2,
      flagged: false,
      title: "Wedstrijd zondag",
      task_date: taskDate,
      assigned_to: null,
      team_id: teamAId,
      notification_sent: false,
    },
  ];

  const { data: tasksData, error: tasksErr } = await admin.from("tasks").insert(taskRows).select("id,title,task_date,assigned_to");

  if (tasksErr) {
    console.error("[api/dev/seed] tasks", tasksErr);
    return NextResponse.json({ error: tasksErr.message, userWarnings }, { status: 500 });
  }

  return NextResponse.json({
    inserted: tasksData?.length ?? taskRows.length,
    teams: teamsInserted?.length ?? 0,
    teamIds: { teamAId, teamBId },
    testUserIds,
    userWarnings: [...fixtureWarnings, ...userWarnings],
  });
}
