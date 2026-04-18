import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { taskId?: string };

/**
 * Admin: handmatige taak afkeuren.
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

  const srv = getSupabaseServiceRole();

  const { data: upd, error: upErr } = await srv
    .from("tasks")
    .update({
      status: "rejected",
      approved_by: null,
      approved_at: null,
      completed_at: null,
      completed_by: null,
    })
    .eq("id", taskId)
    .eq("status", "pending")
    .eq("source", "manual")
    .select("id")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  if (!upd) {
    return NextResponse.json({ error: "Taak niet gevonden of niet in afwachting (manual)" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
