import { NextResponse } from "next/server";

import { defaultMinutesForTaskType, pointsFromDurationMinutes } from "@/lib/points/manualTaskDefaults";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  task_type?: string;
  date?: string;
  team_id?: string | null;
  description?: string | null;
};

/**
 * Handmatige taak: pending tot admin goedkeurt.
 * User via server-client getUser() (cookies / SSR); insert via service role (consistent met bestaande checks).
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authUserErr,
  } = await supabase.auth.getUser();

  if (authUserErr) {
    console.warn("[tasks/manual] getUser:", authUserErr.message);
  }
  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const taskType = typeof body.task_type === "string" ? body.task_type.trim() : "";
  const date = typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";
  if (!taskType || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "task_type en date (YYYY-MM-DD) zijn verplicht" }, { status: 400 });
  }

  let teamId: string | null = null;
  if (body.team_id != null && String(body.team_id).trim() !== "") {
    teamId = String(body.team_id).trim();
  }

  const desc =
    typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;

  let minutes = defaultMinutesForTaskType(taskType);
  let points = pointsFromDurationMinutes(minutes);

  const admin = getSupabaseServiceRole();

  const { data: ruleRow, error: ruleErr } = await admin
    .from("task_type_point_rules")
    .select("default_minutes, basis_points, active")
    .eq("task_type", taskType.toLowerCase())
    .maybeSingle();

  if (!ruleErr && ruleRow && ruleRow.active !== false) {
    const dm = Number(ruleRow.default_minutes);
    const bp = Number(ruleRow.basis_points);
    if (Number.isFinite(dm) && dm > 0) minutes = dm;
    if (Number.isFinite(bp) && bp >= 0) points = bp;
  }

  const { data: existing } = await admin
    .from("tasks")
    .select("id")
    .eq("user_id", user.id)
    .eq("task_date", date)
    .eq("task_type", taskType)
    .eq("source", "manual")
    .eq("status", "pending")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Je hebt deze taak al ingevoerd voor deze datum." },
      { status: 400 }
    );
  }

  const { data: row, error } = await admin
    .from("tasks")
    .insert({
      user_id: user.id,
      assigned_to: user.id,
      created_by: user.id,
      task_type: taskType,
      title: taskType,
      task_date: date,
      team_id: teamId,
      description: desc,
      duration_minutes: minutes,
      points,
      status: "pending",
      source: "manual",
      flagged: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[tasks/manual]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, taskId: row?.id });
}
