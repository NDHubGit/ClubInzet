/**
 * Past toewijzingen toe in Supabase: assigned_to, task_date, team_id, notification_sent (na geslaagde mail).
 *
 * Auto-planning disabled for MVP (geen admin-UI); endpoint en functie blijven voor later.
 * Can be re-enabled when club needs advanced scheduling.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTaskAssignmentEmail } from "@/lib/email/taskAssignmentEmail";
import type { PlanningAssignment } from "@/lib/planning/generatePlanning";

export type ApplyPlanningResult = {
  updated: number;
  errors: string[];
  /** Rijen zoals teruggelezen na update (zelfde volgorde niet gegarandeerd) */
  updatedTasks: Record<string, unknown>[];
};

export async function applyPlanningAssignments(
  supabase: SupabaseClient,
  assignments: PlanningAssignment[],
  options?: { sendAssignmentEmails?: boolean }
): Promise<ApplyPlanningResult> {
  const errors: string[] = [];
  let updated = 0;
  const sendAssignmentEmails = options?.sendAssignmentEmails !== false;

  for (const a of assignments) {
    const payload: {
      assigned_to: string;
      notification_sent: boolean;
      task_date: string;
      status: string;
      team_id?: string | null;
    } = {
      assigned_to: a.assignedTo,
      notification_sent: false,
      task_date: a.taskDate,
      status: "claimed",
    };

    if (a.teamId != null && String(a.teamId).trim() !== "") {
      payload.team_id = a.teamId;
    }

    const { error } = await supabase.from("tasks").update(payload).eq("id", a.taskId);

    if (error) {
      errors.push(`${a.taskId}: ${error.message}`);
      console.error("[applyPlanningAssignments] update failed", a.taskId, error);
    } else {
      updated += 1;
      if (sendAssignmentEmails && String(a.assignedTo).trim() !== "") {
        const mailed = await sendTaskAssignmentEmail(supabase, a.taskId);
        if (mailed) {
          const { error: nErr } = await supabase
            .from("tasks")
            .update({ notification_sent: true })
            .eq("id", a.taskId);
          if (nErr) {
            console.error("[applyPlanningAssignments] notification_sent", a.taskId, nErr);
          }
        }
      }
    }
  }

  console.log("[applyPlanningAssignments] updates applied:", updated, "/", assignments.length);

  const ids = assignments.map((x) => x.taskId);
  let updatedTasks: Record<string, unknown>[] = [];
  if (ids.length > 0) {
    const { data: rows, error: fetchErr } = await supabase.from("tasks").select("*").in("id", ids);
    if (fetchErr) {
      console.warn("[applyPlanningAssignments] kon taken niet herladen:", fetchErr.message);
    } else if (Array.isArray(rows)) {
      updatedTasks = rows as Record<string, unknown>[];
    }
  }

  return { updated, errors, updatedTasks };
}

/**
 * Markeer notificatie als verstuurd (na toast/e-mail).
 */
export async function markTaskNotificationSent(
  supabase: SupabaseClient,
  taskId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({ notification_sent: true })
    .eq("id", taskId);

  if (error) {
    console.error("[markTaskNotificationSent]", error);
    return false;
  }
  return true;
}
