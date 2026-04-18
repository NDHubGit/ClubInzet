import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { DEV_USER_EMAIL, fetchDevProfileByEmail, getDevActorIdFromRequest } from "@/lib/dev/resolveDevProfile";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Development-only: taak invoegen voor eerste profiel (server gebruikt anon key).
 */
export async function POST(req: Request) {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  let body: { task_type?: string; duration_minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const task_type = String(body.task_type ?? "").trim();
  const duration_minutes = Math.floor(Number(body.duration_minutes));
  if (!task_type || !duration_minutes || duration_minutes <= 0) {
    return NextResponse.json({ error: "task_type en geldige duration_minutes vereist" }, { status: 400 });
  }

  let user_id = (await getDevActorIdFromRequest(req)) ?? null;
  if (!user_id) {
    const p = await fetchDevProfileByEmail(DEV_USER_EMAIL);
    user_id = p?.id ?? null;
  }
  if (!user_id) {
    const { data: prof } = await admin.from("profiles").select("id").limit(1).maybeSingle();
    user_id = prof?.id ?? null;
  }
  if (!user_id) {
    return NextResponse.json(
      { error: "Geen profiel — draai POST /api/dev/seed of bootstrap fixture users (user1@test.nl)." },
      { status: 400 }
    );
  }

  const points = duration_minutes / 60;
  const { error } = await admin.from("tasks").insert([
    {
      user_id,
      task_type,
      duration_minutes,
      points,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
