import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { taskIds?: unknown };

/**
 * Admin: meerdere handmatige taken tegelijk goedkeuren (zelfde regels als POST /api/tasks/approve).
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

  const raw = body.taskIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "taskIds (array) verplicht" }, { status: 400 });
  }

  const taskIds = [...new Set(raw.map((x) => String(x ?? "").trim()).filter(Boolean))];
  if (taskIds.length === 0) {
    return NextResponse.json({ error: "Geen geldige taskIds" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const srv = getSupabaseServiceRole();

  let approved = 0;
  const errors: string[] = [];

  for (const taskId of taskIds) {
    const { data: before, error: qErr } = await srv
      .from("tasks")
      .select("id, assigned_to")
      .eq("id", taskId)
      .eq("status", "pending")
      .eq("source", "manual")
      .maybeSingle();

    if (qErr) {
      errors.push(`${taskId}: ${qErr.message}`);
      continue;
    }
    if (!before?.assigned_to) {
      errors.push(`${taskId}: niet in afwachting (manual)`);
      continue;
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
      errors.push(`${taskId}: ${upErr.message}`);
      continue;
    }
    if (upd) approved += 1;
    else errors.push(`${taskId}: update mislukt`);
  }

  if (approved > 0) {
    revalidatePath("/");
    revalidatePath("/user");
    revalidatePath("/klassement");
  }

  return NextResponse.json({ ok: true, approved, errors: errors.length ? errors : undefined });
}
