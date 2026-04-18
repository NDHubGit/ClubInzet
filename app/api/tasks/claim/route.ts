import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { taskId?: string };

const POOL_STATUSES = ["open", "planned"];

/**
 * Pak een open taak op (pool): `planned` (of legacy `open`), geen assignee.
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

  const { data: before, error: qErr } = await admin
    .from("tasks")
    .select("id, status, assigned_to, title, task_type, task_date, admin_active")
    .eq("id", taskId)
    .maybeSingle();

  if (qErr || !before) {
    return NextResponse.json({ error: qErr?.message ?? "Taak niet gevonden" }, { status: 404 });
  }
  if ((before as { admin_active?: boolean | null }).admin_active === false) {
    return NextResponse.json({ error: "Deze taak is niet beschikbaar in de pool" }, { status: 409 });
  }
  const st = String(before.status ?? "").toLowerCase();
  if (!POOL_STATUSES.includes(st) || before.assigned_to != null) {
    return NextResponse.json({ error: "Deze taak is niet meer beschikbaar" }, { status: 409 });
  }

  const { data: updated, error: upErr } = await admin
    .from("tasks")
    .update({
      assigned_to: user.id,
      status: "claimed",
      notification_sent: false,
      reminder_email_sent: false,
      completed_at: null,
      completed_by: null,
    })
    .eq("id", taskId)
    .in("status", POOL_STATUSES)
    .is("assigned_to", null)
    .select("id")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Deze taak is niet meer beschikbaar" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
