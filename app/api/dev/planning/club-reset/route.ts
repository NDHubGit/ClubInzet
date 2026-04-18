import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Development-only: alle taken terug naar open pool (geen toewijzing, geen uitleg).
 */
export async function POST() {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  const { error } = await admin
    .from("tasks")
    .update({
      assigned_to: null,
      status: "planned",
      planning_explanation: null,
      notification_sent: false,
      reminder_email_sent: false,
      completed_at: null,
      completed_by: null,
    })
    .not("id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
