import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { sendPush } from "@/lib/notifications/sendPush";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Assignment = { taskId: string; assignedTo: string };

type Body = {
  assignments?: Assignment[];
};

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

  const assignments = Array.isArray(body.assignments) ? body.assignments : [];
  if (assignments.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const admin = getSupabaseServiceRole();
  let sent = 0;
  const errors: string[] = [];

  for (const a of assignments) {
    if (!a.taskId || !a.assignedTo) continue;

    const { data: taskRow, error: taskErr } = await admin
      .from("tasks")
      .select("id, title, task_type")
      .eq("id", a.taskId)
      .maybeSingle();

    if (taskErr || !taskRow) {
      errors.push(`${a.taskId}: taak niet gevonden`);
      continue;
    }

    const title =
      (taskRow.title && String(taskRow.title).trim()) ||
      (taskRow.task_type && String(taskRow.task_type)) ||
      "Taak";

    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", a.assignedTo);

    if (subErr) {
      errors.push(`${a.assignedTo}: ${subErr.message}`);
      continue;
    }

    for (const row of subs || []) {
      try {
        await sendPush(
          { endpoint: row.endpoint, keys: row.keys as Record<string, unknown> },
          {
            title: "ClubInzet",
            body: `Je bent ingepland voor: ${title}`,
            data: { taskId: a.taskId, type: "assignment" },
          }
        );
        sent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`push ${row.endpoint?.slice(0, 40)}…: ${msg}`);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined });
}
