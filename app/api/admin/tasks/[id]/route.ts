import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import type { TaskAdminPatchBody } from "@/lib/admin/taskAdminTypes";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  const p = await ctx.params;
  const taskId = typeof p?.id === "string" ? p.id.trim() : "";
  if (!taskId) {
    return NextResponse.json({ error: "Ontbrekende taak-id" }, { status: 400 });
  }

  let body: TaskAdminPatchBody;
  try {
    body = (await request.json()) as TaskAdminPatchBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.title !== undefined) patch.title = typeof body.title === "string" ? body.title.trim() || null : null;
  if (body.task_type !== undefined) {
    const tt = typeof body.task_type === "string" ? body.task_type.trim() : "";
    if (!tt) return NextResponse.json({ error: "task_type mag niet leeg zijn" }, { status: 400 });
    patch.task_type = tt;
  }
  if (body.description !== undefined) {
    patch.description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if (body.task_date !== undefined) {
    const d = typeof body.task_date === "string" ? body.task_date.trim() : "";
    patch.task_date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  if (body.duration_minutes !== undefined) {
    const n = Number(body.duration_minutes);
    patch.duration_minutes = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if (body.points !== undefined) {
    const n = Number(body.points);
    patch.points = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if (body.override_points !== undefined) {
    if (body.override_points === null) patch.override_points = null;
    else {
      const n = Number(body.override_points);
      patch.override_points = Number.isFinite(n) ? Math.round(n) : null;
    }
  }
  if (body.status !== undefined && typeof body.status === "string" && body.status.trim()) {
    patch.status = body.status.trim();
  }
  if (body.source !== undefined && typeof body.source === "string" && body.source.trim()) {
    patch.source = body.source.trim();
  }
  if (body.assigned_to !== undefined) {
    patch.assigned_to =
      body.assigned_to != null && String(body.assigned_to).trim() !== "" ? String(body.assigned_to).trim() : null;
  }
  if (body.team_id !== undefined) {
    patch.team_id =
      body.team_id != null && String(body.team_id).trim() !== "" ? String(body.team_id).trim() : null;
  }
  if (body.admin_active !== undefined) {
    patch.admin_active = Boolean(body.admin_active);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Geen velden om bij te werken" }, { status: 400 });
  }

  const srv = getSupabaseServiceRole();
  const { error } = await srv.from("tasks").update(patch).eq("id", taskId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  const p = await ctx.params;
  const taskId = typeof p?.id === "string" ? p.id.trim() : "";
  if (!taskId) {
    return NextResponse.json({ error: "Ontbrekende taak-id" }, { status: 400 });
  }

  const srv = getSupabaseServiceRole();
  const { error } = await srv.from("tasks").delete().eq("id", taskId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
