import type { SupabaseClient } from "@supabase/supabase-js";
import { toDate } from "date-fns-tz";

import { getAppBaseUrl } from "@/lib/email/appUrl";
import { getEmailFrom, getResend } from "@/lib/email/resendMail";
import { normalizeTaskStatus } from "@/lib/planning/taskStatus";

const TZ = "Europe/Amsterdam";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Starttijd van de taak als UTC Date (voor vergelijking met nu). */
export function getTaskStartUtc(
  taskDate: string | null,
  startTime: string | null | undefined,
  taskDueAt: string | null | undefined
): Date | null {
  if (taskDueAt) {
    const d = new Date(String(taskDueAt));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (!taskDate) return null;
  const d = String(taskDate).slice(0, 10);
  const tRaw = startTime != null ? String(startTime).trim() : "";
  const hm = tRaw.length >= 5 ? tRaw.slice(0, 5) : "08:00";
  const dt = toDate(`${d}T${hm}:00`, { timeZone: TZ });
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isWithinNext24Hours(start: Date, now: Date): boolean {
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return start.getTime() >= now.getTime() && start.getTime() <= end.getTime();
}

export type TaskReminderRow = {
  id: string;
  title: string | null;
  task_type: string | null;
  task_date: string | null;
  start_time: string | null;
  task_due_at: string | null;
  assigned_to: string;
  team_id: string | null;
  reminder_email_sent: boolean;
  status: string | null;
};

/**
 * Zoekt toegewezen taken waarvan de start in de komende 24 uur valt en nog geen herinnering is verstuurd.
 */
export async function sendReminderEmailsForUpcomingTasks(
  supabase: SupabaseClient,
  nowInput?: Date
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY ontbreekt — geen herinneringen");
    return { sent: 0, skipped: 0, errors: ["RESEND_API_KEY ontbreekt"] };
  }

  const now = nowInput ?? new Date();

  const { data: rows, error } = await supabase
    .from("tasks")
    .select(
      "id, title, task_type, task_date, start_time, task_due_at, assigned_to, team_id, reminder_email_sent, status"
    )
    .not("assigned_to", "is", null)
    .eq("reminder_email_sent", false);

  if (error) {
    return { sent: 0, skipped: 0, errors: [error.message] };
  }

  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;

  for (const raw of rows || []) {
    const t = raw as TaskReminderRow;
    const st = normalizeTaskStatus(t.status);
    if (st === "completed" || st === "missed" || st === "approved" || st === "pending" || st === "rejected") {
      skipped += 1;
      continue;
    }

    const start = getTaskStartUtc(t.task_date, t.start_time, t.task_due_at);
    if (!start || !isWithinNext24Hours(start, now)) {
      skipped += 1;
      continue;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", t.assigned_to)
      .maybeSingle();

    if (!profile?.email) {
      errors.push(`${t.id}: geen e-mailadres`);
      skipped += 1;
      continue;
    }

    const title = (t.title && String(t.title).trim()) || String(t.task_type ?? "Clubtaak");
    const datum = t.task_date != null ? String(t.task_date).slice(0, 10) : "—";
    const teamRef = t.team_id ? `${String(t.team_id).slice(0, 8)}…` : "—";
    const appUrl = getAppBaseUrl();

    const html = `
      <p>Hallo${profile.display_name ? ` ${escapeHtml(String(profile.display_name))}` : ""},</p>
      <p>Herinnering: je clubtaak begint binnen 24 uur.</p>
      <ul>
        <li><strong>Taak:</strong> ${escapeHtml(title)}</li>
        <li><strong>Datum:</strong> ${escapeHtml(datum)}</li>
        <li><strong>Team-id:</strong> ${escapeHtml(teamRef)}</li>
      </ul>
      <p><a href="${escapeHtml(appUrl)}">Open ClubInzet</a></p>
    `.trim();
    const text = [
      "Herinnering clubtaak (binnen 24 uur)",
      "",
      `Taak: ${title}`,
      `Datum: ${datum}`,
      `Team-id: ${teamRef}`,
      "",
      `App: ${appUrl}`,
    ].join("\n");

    const { error: sendErr } = await resend.emails.send({
      from: getEmailFrom(),
      to: [String(profile.email)],
      subject: "Herinnering: clubtaak binnenkort",
      html,
      text,
    });

    if (sendErr) {
      errors.push(`${t.id}: ${sendErr.message}`);
      continue;
    }

    const { error: upErr } = await supabase
      .from("tasks")
      .update({ reminder_email_sent: true })
      .eq("id", t.id);

    if (upErr) {
      errors.push(`${t.id}: kon reminder_email_sent niet zetten: ${upErr.message}`);
    } else {
      sent += 1;
    }
  }

  return { sent, skipped, errors };
}
