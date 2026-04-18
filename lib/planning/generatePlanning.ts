/**
 * Planning: profielen laden + round-robin met task_date en team_id.
 *
 * Auto-planning disabled for MVP — geen UI-knop; logica blijft beschikbaar voor later.
 * Can be re-enabled when a club needs advanced scheduling.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanningUser = {
  id: string;
  name: string;
  role: string | null;
};

export type PlanningTask = {
  id: string;
  title?: string | null;
  task_type?: string | null;
  task_date?: string | null;
  created_at?: string | null;
  team_id?: string | null;
  user_id: string;
};

export type PlanningAssignment = {
  taskId: string;
  assignedTo: string;
  /** YYYY-MM-DD */
  taskDate: string;
  /** Alleen gezet als er een waarde is (bestaand of fallback) */
  teamId: string | null;
};

export type GeneratePlanningOptions = {
  /** @deprecated */
  excludeAdmins?: boolean;
  /** @deprecated */
  avoidSameDayDouble?: boolean;
};

function taskDateKey(t: PlanningTask): string {
  if (t.task_date) return String(t.task_date).slice(0, 10);
  if (t.created_at) return String(t.created_at).slice(0, 10);
  return "";
}

function isNonAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "").toLowerCase() !== "admin";
}

/**
 * Alle profielen (geen .limit) — planbare gebruikers = role ≠ admin.
 * Gooit een duidelijke fout als er niemand planbaar is.
 */
export async function fetchPlanningUserPool(supabase: SupabaseClient): Promise<PlanningUser[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) {
    throw new Error(`Profielen laden mislukt: ${error.message}`);
  }
  const rows = Array.isArray(data) ? data : [];
  type ProfileRow = {
    id: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    role?: string | null;
  };
  console.log(
    "[fetchPlanningUserPool] RAW PROFILE ROWS (no limit, before admin filter):",
    rows.length,
    (rows as ProfileRow[]).map((r) => ({ id: r.id, role: r.role }))
  );

  const pool = (rows as ProfileRow[])
    .filter((p) => isNonAdminRole(p.role))
    .map((p) => ({
      id: String(p.id),
      name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || String(p.email ?? p.id),
      role: p.role != null && p.role !== "" ? String(p.role) : null,
    }));
  console.log("[fetchPlanningUserPool] non-admin planning users:", pool.length);

  if (pool.length === 0) {
    throw new Error(
      "Geen planbare gebruikers: er zijn geen profielen met een rol anders dan admin. Voeg leden toe of pas rollen aan."
    );
  }

  return pool;
}

/**
 * Round-robin assigned_to, opeenvolgende task_date (vandaag + index dagen),
 * team_id: behoud bestaande of gebruik eerste bekende team in de batch als fallback.
 */
export function generatePlanning(
  users: PlanningUser[],
  tasks: PlanningTask[],
  _options?: GeneratePlanningOptions
): PlanningAssignment[] {
  void _options;

  const eligible = users.filter((u) => u?.id && isNonAdminRole(u.role));
  console.log("RAW USERS:", eligible.length);

  const uniqueUsers = Array.from(new Map(eligible.map((u) => [u.id, u])).values());
  console.log("UNIQUE USERS:", uniqueUsers.length);

  const pool = uniqueUsers;
  if (pool.length === 0) {
    throw new Error("Geen gebruikers in de pool voor planning (alleen admins of lege lijst).");
  }
  if (tasks.length === 0) {
    return [];
  }

  const sorted = [...tasks].sort((a, b) => {
    const da = taskDateKey(a);
    const db = taskDateKey(b);
    if (da !== db) return da.localeCompare(db);
    return String(a.id).localeCompare(String(b.id));
  });

  const fallbackTeamId =
    sorted.map((t) => t.team_id).find((id) => id != null && String(id).trim() !== "") ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(
    "POOL:",
    pool.map((u) => ({ id: u.id, name: u.name }))
  );
  console.log("[generatePlanning] pool size:", pool.length, "tasks:", sorted.length);
  if (pool.length === 1) {
    console.warn(
      "[generatePlanning] slechts één gebruiker in de pool — alle taken gaan naar dezelfde persoon. Voeg meer profielen toe (niet-admin)."
    );
  }

  const assignments: PlanningAssignment[] = [];

  sorted.forEach((task, index) => {
    const user = pool[index % pool.length]!;
    const day = new Date(today.getTime() + index * 86400000);
    const taskDate = day.toISOString().slice(0, 10);
    const teamIdRaw = task.team_id ?? fallbackTeamId;
    const teamId = teamIdRaw != null && String(teamIdRaw).trim() !== "" ? String(teamIdRaw) : null;

    console.log("Assigning", task.id, "to", user.id);

    assignments.push({
      taskId: task.id,
      assignedTo: user.id,
      taskDate,
      teamId,
    });
  });

  return assignments;
}

/** Map DB-rij naar PlanningTask (client-safe, geen server-e-mail). */
export function tasksToPlanningTasks(rows: unknown[]): PlanningTask[] {
  return (rows as PlanningTask[]).map((r) => ({
    id: String(r.id),
    title: r.title ?? null,
    task_type: r.task_type ?? null,
    task_date: r.task_date ?? null,
    created_at: r.created_at ?? null,
    team_id: r.team_id ?? null,
    user_id: String(r.user_id),
  }));
}
