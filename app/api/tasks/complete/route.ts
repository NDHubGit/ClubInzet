import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isClaimedStatus } from "@/lib/planning/taskStatus";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { taskId?: string };

/**
 * Markeer toegewezen taak als voltooid.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { user } = auth;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  if (!taskId) {
    return NextResponse.json({ error: "taskId verplicht" }, { status: 400 });
  }

  const admin = getSupabaseServiceRole();
  const { data: row, error: qErr } = await admin
    .from("tasks")
    .select("assigned_to, status")
    .eq("id", taskId)
    .maybeSingle();

  if (qErr || !row) {
    return NextResponse.json({ error: qErr?.message ?? "Taak niet gevonden" }, { status: 404 });
  }
  if (String(row.assigned_to) !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isClaimedStatus(row.status)) {
    return NextResponse.json({ error: "Taak is niet in status ‘claimed’" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: upd, error: upErr } = await admin
    .from("tasks")
    .update({
      status: "completed",
      completed_at: now,
      completed_by: user.id,
    })
    .eq("id", taskId)
    .eq("assigned_to", user.id)
    .eq("status", "claimed")
    .select("id")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  if (!upd) {
    return NextResponse.json({ error: "Taak kon niet worden afgerond (status gewijzigd?)" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
