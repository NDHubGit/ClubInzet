import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import type { TaskAdminCreateBody } from "@/lib/admin/taskAdminTypes";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_LIST = 500;

/**
 * GET: takenlijst voor admin-beheer.
 * POST: nieuwe taak (pool of met toewijzing); `user_id`/`created_by` = admin.
 */
export async function GET(request: Request) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  const srv = getSupabaseServiceRole();
  const { data, error } = await srv
    .from("tasks")
    .select(
      "id, title, task_type, description, task_date, duration_minutes, points, override_points, status, source, assigned_to, team_id, admin_active, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(MAX_LIST);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  let body: TaskAdminCreateBody;
  try {
    body = (await request.json()) as TaskAdminCreateBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const taskType = typeof body.task_type === "string" ? body.task_type.trim() : "";
  if (!taskType) {
    return NextResponse.json({ error: "task_type is verplicht" }, { status: 400 });
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : taskType;
  const duration = Number(body.duration_minutes);
  const dur = Number.isFinite(duration) && duration >= 0 ? duration : 60;
  const pts = Number(body.points);
  const points = Number.isFinite(pts) && pts >= 0 ? pts : 0;
  const taskDate =
    typeof body.task_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.task_date.trim())
      ? body.task_date.trim()
      : null;
  const desc =
    typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const assigned =
    body.assigned_to != null && String(body.assigned_to).trim() !== "" ? String(body.assigned_to).trim() : null;
  const teamId = body.team_id != null && String(body.team_id).trim() !== "" ? String(body.team_id).trim() : null;
  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim()
      : assigned
        ? "claimed"
        : "planned";
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "planned";
  const adminActive = body.admin_active !== false;

  const srv = getSupabaseServiceRole();
  const { data, error } = await srv
    .from("tasks")
    .insert({
      user_id: gate.userId,
      created_by: gate.userId,
      task_type: taskType,
      title,
      description: desc,
      task_date: taskDate,
      duration_minutes: dur,
      points,
      status,
      source,
      assigned_to: assigned,
      team_id: teamId,
      flagged: false,
      admin_active: adminActive,
      notification_sent: false,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, taskId: data?.id ?? null });
}
