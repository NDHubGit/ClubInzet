/**
 * Auto-planning disabled for MVP — alleen dev/API-paden; geen productie-UI.
 * Can be re-enabled when club needs advanced scheduling.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTaskAssignmentEmail } from "@/lib/email/taskAssignmentEmail";
import type { ClubPlanningAssignment } from "@/lib/planning/clubTypes";

export type ApplyClubPlanningResult = {
  updated: number;
  errors: string[];
  updatedTasks: Record<string, unknown>[];
};

/**
 * Schrijft clubplanning naar `tasks`: assigned_to, task_date, status, planning_explanation, optioneel team_id.
 */
export async function applyClubPlanningAssignments(
  supabase: SupabaseClient,
  results: ClubPlanningAssignment[],
  options?: { sendAssignmentEmails?: boolean }
): Promise<ApplyClubPlanningResult> {
  const sendAssignmentEmails = options?.sendAssignmentEmails !== false;
  const errors: string[] = [];
  let updated = 0;

  for (const r of results) {
    const payload: Record<string, unknown> = {
      assigned_to: r.assignedTo,
      task_date: r.taskDate,
      status: "claimed",
      planning_explanation: r.explanation,
      notification_sent: false,
    };
    if (r.teamId != null && String(r.teamId).trim() !== "") {
      payload.team_id = r.teamId;
    }

    const { error } = await supabase.from("tasks").update(payload).eq("id", r.taskId);
    if (error) {
      errors.push(`${r.taskId}: ${error.message}`);
      console.error("[applyClubPlanningAssignments]", r.taskId, error);
    } else {
      updated += 1;
      if (sendAssignmentEmails && String(r.assignedTo).trim() !== "") {
        const mailed = await sendTaskAssignmentEmail(supabase, r.taskId);
        if (mailed) {
          const { error: nErr } = await supabase
            .from("tasks")
            .update({ notification_sent: true })
            .eq("id", r.taskId);
          if (nErr) {
            console.error("[applyClubPlanningAssignments] notification_sent", r.taskId, nErr);
          }
        }
      }
    }
  }

  console.log("[applyClubPlanningAssignments] updates applied:", updated, "/", results.length);

  const ids = results.map((x) => x.taskId);
  let updatedTasks: Record<string, unknown>[] = [];
  if (ids.length > 0) {
    const { data: rows, error: fetchErr } = await supabase.from("tasks").select("*").in("id", ids);
    if (fetchErr) {
      console.warn("[applyClubPlanningAssignments] reload:", fetchErr.message);
    } else if (Array.isArray(rows)) {
      updatedTasks = rows as Record<string, unknown>[];
    }
  }

  return { updated, errors, updatedTasks };
}
