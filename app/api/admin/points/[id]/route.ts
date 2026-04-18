import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import type { PointRulePatchBody } from "@/lib/admin/pointsAdminTypes";
import { adminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  const p = await ctx.params;
  const ruleId = typeof p?.id === "string" ? p.id.trim() : "";
  if (!ruleId) {
    return NextResponse.json({ error: "Ontbrekende id" }, { status: 400 });
  }

  let body: PointRulePatchBody;
  try {
    body = (await request.json()) as PointRulePatchBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.task_type !== undefined) {
    const tt = typeof body.task_type === "string" ? body.task_type.trim().toLowerCase() : "";
    if (!tt) return NextResponse.json({ error: "task_type mag niet leeg zijn" }, { status: 400 });
    patch.task_type = tt;
  }
  if (body.label !== undefined) {
    patch.label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "";
  }
  if (body.default_minutes !== undefined) {
    const n = Number(body.default_minutes);
    patch.default_minutes = Number.isFinite(n) && n > 0 ? n : 60;
  }
  if (body.basis_points !== undefined) {
    const n = Number(body.basis_points);
    patch.basis_points = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  if (body.description !== undefined) {
    patch.description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if (body.active !== undefined) {
    patch.active = Boolean(body.active);
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "Geen velden om bij te werken" }, { status: 400 });
  }

  const { error } = await adminClient.from("task_type_point_rules").update(patch).eq("id", ruleId);
  if (error) {
    console.error("[api/admin/points PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const gate = await requireAdminRequest(request);
  if (!gate.ok) return gate.response;

  const p = await ctx.params;
  const ruleId = typeof p?.id === "string" ? p.id.trim() : "";
  if (!ruleId) {
    return NextResponse.json({ error: "Ontbrekende id" }, { status: 400 });
  }

  const { error } = await adminClient.from("task_type_point_rules").delete().eq("id", ruleId);
  if (error) {
    console.error("[api/admin/points DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
