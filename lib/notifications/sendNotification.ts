/**
 * MVP-notificaties: in-app (toast/alert) + stubs voor e-mail en web push.
 */

import type { PlanningTask } from "@/lib/planning/generatePlanning";

export type NotifiableUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

/**
 * Bouwt een korte NL-melding voor een toegewezen taak.
 */
export function formatTaskAssignmentMessage(
  user: NotifiableUser,
  task: PlanningTask
): string {
  const who = user.name || user.email || "Vrijwilliger";
  const label = (task.title || task.task_type || "Taak").trim();
  const datePart = task.task_date
    ? ` (${task.task_date})`
    : task.created_at
      ? ` (${String(task.created_at).slice(0, 10)})`
      : "";
  return `${who}, je bent ingepland voor: ${label}${datePart}`;
}

/**
 * In-app MVP: roept optioneel callback aan, anders alert (alleen browser).
 */
export function sendTaskInAppNotification(
  message: string,
  opts?: { useAlert?: boolean; onToast?: (msg: string) => void }
): void {
  if (typeof window === "undefined") return;
  if (opts?.onToast) {
    opts.onToast(message);
    return;
  }
  if (opts?.useAlert === false) return;
  window.alert(message);
}

/**
 * Hoofdfunctie voor “notificatie verstuurd” — nu: in-app + log; e-mail later.
 */
export async function sendTaskNotification(
  user: NotifiableUser,
  task: PlanningTask,
  options?: { onToast?: (msg: string) => void }
): Promise<{ channel: "in_app" | "email_skipped"; message: string }> {
  const message = formatTaskAssignmentMessage(user, task);
  sendTaskInAppNotification(message, { onToast: options?.onToast });
  if (process.env.NODE_ENV === "development") {
    console.info("[sendTaskNotification]", message);
  }
  return { channel: "in_app", message };
}

/**
 * Placeholder: later Supabase Edge Function / Resend / SendGrid.
 */
export async function sendTaskNotificationEmail(
  user: NotifiableUser,
  task: PlanningTask
): Promise<{ ok: boolean; skipped: boolean }> {
  console.info("[sendTaskNotificationEmail] stub — nog niet geconfigureerd", {
    to: user.email,
    taskId: task.id,
  });
  return { ok: false, skipped: true };
}

/** Structuur voor toekomstige web push (subscription in DB) */
export type WebPushSubscriptionRecord = {
  userId: string;
  endpoint: string;
  keys?: Record<string, string>;
};

export function savePushSubscriptionStub(_rec: WebPushSubscriptionRecord): void {
  console.info("[push] subscription opslaan — later uitbreiden");
}
