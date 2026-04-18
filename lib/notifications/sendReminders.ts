import { normalizeTaskStatus } from "@/lib/planning/taskStatus";
import { sendPush } from "@/lib/notifications/sendPush";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export type SendRemindersResult = {
  sent: number;
  warnings?: string[];
};

function hoursUntilDue(due: Date, now: Date): number {
  return (due.getTime() - now.getTime()) / 3_600_000;
}

/**
 * Zoekt toegewezen taken met task_due_at in het 24u- en 1u-venster vóór de deadline
 * en stuurt push naar alle devices van de ingeplande gebruiker.
 * Service role alleen server-side aanroepen (bijv. vanuit cron route).
 */
export async function sendRemindersForDueTasks(nowInput?: Date): Promise<SendRemindersResult> {
  const admin = getSupabaseServiceRole();
  const now = nowInput ?? new Date();

  const { data: tasks, error } = await admin
    .from("tasks")
    .select(
      "id, title, task_type, task_due_at, assigned_to, reminder_24h_sent, reminder_1h_sent, status"
    )
    .not("task_due_at", "is", null)
    .not("assigned_to", "is", null)
    .or("reminder_24h_sent.eq.false,reminder_1h_sent.eq.false");

  if (error) {
    throw new Error(error.message);
  }

  let sent = 0;
  const log: string[] = [];

  for (const t of tasks || []) {
    const st = normalizeTaskStatus((t as { status?: string }).status);
    if (st !== "claimed") continue;
    const due = t.task_due_at ? new Date(String(t.task_due_at)) : null;
    if (!due || Number.isNaN(due.getTime())) continue;

    const h = hoursUntilDue(due, now);
    if (h < 0) continue;

    const taskLabel =
      (t.title && String(t.title).trim()) ||
      (t.task_type && String(t.task_type)) ||
      "Taak";

    const userId = String(t.assigned_to);

    let send24 = false;
    let send1 = false;

    if (!t.reminder_24h_sent && h >= 23 && h <= 25) {
      send24 = true;
    }
    if (!t.reminder_1h_sent && h >= 0.5 && h <= 1.5) {
      send1 = true;
    }

    if (!send24 && !send1) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", userId);

    const bodyReminder = `Reminder: ${taskLabel} begint binnenkort`;

    let any24 = false;
    let any1 = false;

    for (const row of subs || []) {
      try {
        if (send24) {
          await sendPush(
            { endpoint: row.endpoint, keys: row.keys as Record<string, unknown> },
            {
              title: "Herinnering — ClubInzet",
              body: bodyReminder,
              data: { taskId: t.id, type: "reminder_24h" },
            }
          );
          any24 = true;
          sent += 1;
        }
        if (send1) {
          await sendPush(
            { endpoint: row.endpoint, keys: row.keys as Record<string, unknown> },
            {
              title: "Herinnering — ClubInzet",
              body: bodyReminder,
              data: { taskId: t.id, type: "reminder_1h" },
            }
          );
          any1 = true;
          sent += 1;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.push(`${t.id}: ${msg}`);
      }
    }

    const patch: Record<string, boolean> = {};
    if (send24 && any24) patch.reminder_24h_sent = true;
    if (send1 && any1) patch.reminder_1h_sent = true;
    if (Object.keys(patch).length > 0) {
      await admin.from("tasks").update(patch).eq("id", t.id);
    }
  }

  return { sent, warnings: log.length ? log : undefined };
}
