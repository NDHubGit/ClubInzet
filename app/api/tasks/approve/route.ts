import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { taskId?: string };

/**
 * Admin: handmatige taak goedkeuren → completed + punten tellen mee.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { user } = auth;

  const adminOk = await isUserAdmin(user.id);
  if (!adminOk) {
    return NextResponse.json({ error: "Forbidden — alleen admin" }, { status: 403 });
  }

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

  const now = new Date().toISOString();
  const srv = getSupabaseServiceRole();

  const { data: before, error: qErr } = await srv
    .from("tasks")
    .select("id, assigned_to")
    .eq("id", taskId)
    .eq("status", "pending")
    .eq("source", "manual")
    .maybeSingle();

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  if (!before?.assigned_to) {
    return NextResponse.json({ error: "Taak niet gevonden of niet in afwachting (manual)" }, { status: 409 });
  }

  const { data: upd, error: upErr } = await srv
    .from("tasks")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: now,
      completed_at: now,
      completed_by: String(before.assigned_to),
    })
    .eq("id", taskId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  if (!upd) {
    return NextResponse.json({ error: "Update mislukt (concurrentie?)" }, { status: 409 });
  }

  revalidatePath("/");
  revalidatePath("/user");
  revalidatePath("/klassement");

  return NextResponse.json({ ok: true, approved_at: now });
}
