import { NextResponse } from "next/server";

import { debugAdminRouteGateOutcome, debugAdminRouteIncoming } from "@/lib/admin/debugAdminRouteIncoming";
import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_ROWS = 800;

/**
 * Gefilterde taken voor admin-beoordeling (server-side filter, compacte payload).
 * Auth: identiek aan `task-type-rules` — `requireAdminRequest` +zelfde Bearer/cookie-flow.
 */
export async function GET(request: Request) {
  debugAdminRouteIncoming(request, "review-tasks");

  const gate = await requireAdminRequest(request, "review-tasks");
  debugAdminRouteGateOutcome("review-tasks", gate);
  if (!gate.ok) {
    return gate.response;
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = (searchParams.get("status") ?? "pending").toLowerCase().trim();
  const sourceFilter = (searchParams.get("source") ?? "manual").toLowerCase().trim();
  const dateFrom = searchParams.get("date_from")?.trim() || null;
  const dateTo = searchParams.get("date_to")?.trim() || null;
  const taskType = searchParams.get("task_type")?.trim() || null;

  const srv = getSupabaseServiceRole();
  let q = srv
    .from("tasks")
    .select(
      "id, title, task_type, task_date, created_at, user_id, assigned_to, created_by, status, source, description, points, override_points, planning_explanation"
    )
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (statusFilter && statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }
  if (sourceFilter && sourceFilter !== "all") {
    q = q.eq("source", sourceFilter);
  }
  if (dateFrom) {
    q = q.gte("task_date", dateFrom);
  }
  if (dateTo) {
    q = q.lte("task_date", dateTo);
  }
  if (taskType) {
    q = q.eq("task_type", taskType);
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = data ?? [];

  /** Koppel profielen server-side (service role); client `profilesMap` was vaak incompleet voor nieuwe gebruikers. */
  const userIds = [
    ...new Set(
      tasks
        .map((row) => {
          const r = row as { assigned_to?: string | null; user_id?: string | null; created_by?: string | null };
          const a = r.assigned_to != null && String(r.assigned_to).trim() !== "" ? String(r.assigned_to) : null;
          const u = r.user_id != null && String(r.user_id).trim() !== "" ? String(r.user_id) : null;
          const c = r.created_by != null && String(r.created_by).trim() !== "" ? String(r.created_by) : null;
          return a ?? u ?? c;
        })
        .filter((x): x is string => Boolean(x))
    ),
  ];

  const profileById = new Map<string, Record<string, unknown>>();
  if (userIds.length > 0) {
    const { data: profs, error: pErr } = await srv
      .from("profiles")
      .select("id, email, display_name, name, first_name, last_name")
      .in("id", userIds);
    if (!pErr && Array.isArray(profs)) {
      for (const p of profs) {
        const id = (p as { id?: string }).id;
        if (id) profileById.set(String(id), p as Record<string, unknown>);
      }
    }
  }

  const enriched = tasks.map((row) => {
    const r = row as { assigned_to?: string | null; user_id?: string | null; created_by?: string | null };
    const a = r.assigned_to != null && String(r.assigned_to).trim() !== "" ? String(r.assigned_to) : null;
    const u = r.user_id != null && String(r.user_id).trim() !== "" ? String(r.user_id) : null;
    const c = r.created_by != null && String(r.created_by).trim() !== "" ? String(r.created_by) : null;
    const uid = a ?? u ?? c;
    const assignee_profile = uid ? profileById.get(uid) ?? null : null;
    return { ...row, assignee_profile };
  });

  return NextResponse.json({ tasks: enriched });
}
