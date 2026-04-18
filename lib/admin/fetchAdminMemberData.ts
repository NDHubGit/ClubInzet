import type { SupabaseClient } from "@supabase/supabase-js";

import { buildMemberExportRows, type ProfileLike, type TaskLike } from "@/lib/admin/aggregateMembers";

/**
 * Server-only: profielen + toegewezen taken (compacte kolommen) voor aggregatie.
 */
export async function fetchProfilesAndAssignedTasks(admin: SupabaseClient): Promise<{
  profiles: ProfileLike[];
  tasks: TaskLike[];
}> {
  const [{ data: profiles, error: pErr }, { data: tasks, error: tErr }] = await Promise.all([
    admin.from("profiles").select("id, email, display_name, role"),
    admin
      .from("tasks")
      .select("assigned_to, status, points, override_points")
      .not("assigned_to", "is", null),
  ]);

  if (pErr) throw new Error(pErr.message);
  if (tErr) throw new Error(tErr.message);

  return {
    profiles: (profiles ?? []) as ProfileLike[],
    tasks: (tasks ?? []) as TaskLike[],
  };
}

export function memberRowsForExport(profiles: ProfileLike[], tasks: TaskLike[]) {
  return buildMemberExportRows(profiles, tasks, { excludeAdmins: true });
}
