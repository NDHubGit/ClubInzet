import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  let body: { poolUserId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const poolUserId = typeof body.poolUserId === "string" ? body.poolUserId : null;
  if (!poolUserId) {
    return NextResponse.json({ error: "poolUserId vereist" }, { status: 400 });
  }

  const { error } = await admin
    .from("tasks")
    .update({ assigned_to: null, notification_sent: false, reminder_email_sent: false })
    .eq("user_id", poolUserId)
    .not("assigned_to", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
