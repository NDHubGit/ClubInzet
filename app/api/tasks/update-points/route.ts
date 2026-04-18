import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  task_id?: string;
  override_points?: number | null;
};

/**
 * Admin: override punten op een handmatige taak in afwachting.
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

  const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
  if (!taskId) {
    return NextResponse.json({ error: "task_id verplicht" }, { status: 400 });
  }

  let overridePoints: number | null = null;
  if (body.override_points !== undefined && body.override_points !== null) {
    const n = Number(body.override_points);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "override_points moet een getal zijn" }, { status: 400 });
    }
    overridePoints = Math.round(n);
  }

  const srv = getSupabaseServiceRole();

  const { data: before, error: qErr } = await srv
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("status", "pending")
    .eq("source", "manual")
    .maybeSingle();

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ error: "Taak niet gevonden of niet te beoordelen (manual/pending)" }, { status: 404 });
  }

  const { error: upErr } = await srv.from("tasks").update({ override_points: overridePoints }).eq("id", taskId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
