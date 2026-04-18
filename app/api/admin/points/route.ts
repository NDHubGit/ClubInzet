import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import type { PointRuleCreateBody } from "@/lib/admin/pointsAdminTypes";
import { adminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  const { data, error } = await adminClient
    .from("task_type_point_rules")
    .select("*")
    .order("task_type", { ascending: true });

  if (error) {
    console.error("[api/admin/points GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  let body: PointRuleCreateBody;
  try {
    body = (await request.json()) as PointRuleCreateBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const taskType = typeof body.task_type === "string" ? body.task_type.trim().toLowerCase() : "";
  if (!taskType) {
    return NextResponse.json({ error: "task_type is verplicht" }, { status: 400 });
  }
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : taskType;
  const dm = Number(body.default_minutes);
  const defaultMinutes = Number.isFinite(dm) && dm > 0 ? dm : 60;
  const bp = Number(body.basis_points);
  const basisPoints = Number.isFinite(bp) && bp >= 0 ? bp : 1;
  const description =
    typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  const active = body.active !== false;

  const { data, error } = await adminClient
    .from("task_type_point_rules")
    .insert({
      task_type: taskType,
      label,
      default_minutes: defaultMinutes,
      basis_points: basisPoints,
      description,
      active,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[api/admin/points POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
