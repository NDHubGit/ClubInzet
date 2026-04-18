import { NextResponse } from "next/server";

import { sendReminderEmailsForUpcomingTasks } from "@/lib/email/taskReminderEmail";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer === secret) return true;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

/**
 * GET/POST — 24u herinneringsmails (Resend). Zelfde auth als /api/cron/reminders.
 */
export async function GET(request: Request) {
  return runEmailReminders(request);
}

export async function POST(request: Request) {
  return runEmailReminders(request);
}

async function runEmailReminders(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServiceRole();
    const result = await sendReminderEmailsForUpcomingTasks(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/email-reminders]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
