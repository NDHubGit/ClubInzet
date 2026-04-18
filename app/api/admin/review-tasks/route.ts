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
      "id, title, task_type, task_date, created_at, assigned_to, status, source, description, points, override_points, planning_explanation"
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

  return NextResponse.json({ tasks: data ?? [] });
}
