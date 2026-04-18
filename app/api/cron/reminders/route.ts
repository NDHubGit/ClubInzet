import { NextResponse } from "next/server";

import { sendRemindersForDueTasks } from "@/lib/notifications/sendReminders";

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
 * GET of POST — aanroepen vanuit Supabase cron, GitHub Actions, of handmatig met CRON_SECRET.
 * Controleert taken met task_due_at; verstuurt max. één 24u- en één 1u-reminder per taak.
 */
export async function GET(request: Request) {
  return runReminders(request);
}

export async function POST(request: Request) {
  return runReminders(request);
}

async function runReminders(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sent, warnings } = await sendRemindersForDueTasks();
    return NextResponse.json({ ok: true, sent, warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/reminders]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
