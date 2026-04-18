/**
 * Auto-planning disabled for MVP — gebruikt door dev/club-generate; geen automatische runs in de app.
 * Can be re-enabled when club needs advanced scheduling.
 */

import type { ClubPlanningAssignment, ClubPlanningOutcome, ClubTask, MonthlyLoad, VolunteerCandidate } from "@/lib/planning/clubTypes";
import { normalizeTaskTypeToStandard } from "@/lib/planning/normalizeTaskType";
import { scoreVolunteerForTask } from "@/lib/planning/scoreVolunteerForTask";
import { isTaskPlannable } from "@/lib/planning/taskStatus";
import { filterVolunteersByTaskRules } from "@/lib/planning/volunteerTypeRules";
import { effectiveTaskPoints } from "@/lib/points/volunteerPoints";

const PRIORITY_ORDER: Record<string, number> = { hoog: 0, normaal: 1, laag: 2 };

function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") console.log(...args);
}

function devWarn(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") console.warn(...args);
}

function defaultTaskDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Kalendermaand voor maandbelasting (op basis van eerste taak met datum, anders vandaag). */
export function planningMonthFromTasks(tasks: ClubTask[]): { year: number; month: number } {
  const t = tasks.find((x) => x.task_date);
  if (t?.task_date) {
    const [y, m] = String(t.task_date).slice(0, 10).split("-").map(Number);
    return { year: y, month: m };
  }
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1 };
}

function normalizeClubTask(t: ClubTask): ClubTask {
  const task_date =
    t.task_date != null && String(t.task_date).trim() !== "" ? String(t.task_date).slice(0, 10) : defaultTaskDate();
  const priority = (t.priority ?? "normaal") as ClubTask["priority"];
  const status = (t.status ?? "open") as ClubTask["status"];
  return {
    ...t,
    task_date,
    priority,
    status,
  };
}

/** Zet ruwe DB-rijen om naar ClubTask (best-effort). */
export function rowsToClubTasks(rows: unknown[]): ClubTask[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    title: r.title != null ? String(r.title) : "Taak",
    task_type: r.task_type != null ? String(r.task_type) : "algemeen",
    team_id: r.team_id != null ? String(r.team_id) : null,
    team_category:
      (r as Record<string, unknown>).team_category != null
        ? String((r as Record<string, unknown>).team_category)
        : null,
    task_date: r.task_date != null ? String(r.task_date).slice(0, 10) : null,
    duration_minutes: Number(r.duration_minutes) || 0,
    points: effectiveTaskPoints(r as { points?: unknown; override_points?: unknown | null }),
    priority: (r.priority != null ? String(r.priority) : "normaal") as ClubTask["priority"],
    status: (r.status != null ? String(r.status) : "open") as ClubTask["status"],
    user_id: String(r.user_id),
    assigned_to: r.assigned_to != null ? String(r.assigned_to) : null,
    admin_active: (r as Record<string, unknown>).admin_active === false ? false : true,
  }));
}

function isUnavailOnDate(v: VolunteerCandidate, taskDate: string): boolean {
  return v.unavailableDates.includes(taskDate.slice(0, 10));
}

function getLoad(map: Map<string, MonthlyLoad>, id: string): MonthlyLoad {
  return map.get(id) ?? { taskCount: 0, pointsSum: 0 };
}

function getSameTeamCombined(
  monthlySameTeam: Map<string, Map<string, number>>,
  provSameTeam: Map<string, Map<string, number>>,
  profileId: string,
  teamId: string | null | undefined
): number {
  if (!teamId) return 0;
  const t = String(teamId);
  const a = monthlySameTeam.get(profileId)?.get(t) ?? 0;
  const b = provSameTeam.get(profileId)?.get(t) ?? 0;
  return a + b;
}

function bumpProvSameTeam(
  prov: Map<string, Map<string, number>>,
  profileId: string,
  teamId: string | null | undefined
): void {
  if (!teamId) return;
  const t = String(teamId);
  if (!prov.has(profileId)) prov.set(profileId, new Map());
  const m = prov.get(profileId)!;
  m.set(t, (m.get(t) ?? 0) + 1);
}

/**
 * Tie-break: hoogste score → minst taken deze maand (incl. prov) → minst punten → langste geleden ingezet.
 */
function compareCandidates(
  a: { v: VolunteerCandidate; score: number; unavailable: boolean },
  b: { v: VolunteerCandidate; score: number; unavailable: boolean },
  monthlyLoad: Map<string, MonthlyLoad>,
  provT: Map<string, number>,
  provP: Map<string, number>,
  lastAssigned: Map<string, string | null>
): number {
  if (b.score !== a.score) return b.score - a.score;

  const loadA = getLoad(monthlyLoad, a.v.profileId);
  const loadB = getLoad(monthlyLoad, b.v.profileId);
  const ca = loadA.taskCount + (provT.get(a.v.profileId) ?? 0);
  const cb = loadB.taskCount + (provT.get(b.v.profileId) ?? 0);
  if (ca !== cb) return ca - cb;

  const pa = loadA.pointsSum + (provP.get(a.v.profileId) ?? 0);
  const pb = loadB.pointsSum + (provP.get(b.v.profileId) ?? 0);
  if (pa !== pb) return pa - pb;

  const la = lastAssigned.get(a.v.profileId) ?? "0000-01-01";
  const lb = lastAssigned.get(b.v.profileId) ?? "0000-01-01";
  if (la !== lb) return la.localeCompare(lb);

  return a.v.displayName.localeCompare(b.v.displayName);
}

/** Korte, leesbare uitlegregel voor in de database (~100 tekens). */
function formatPlanningExplanation(summaryHints: string[], displayName: string, relaxedDate: boolean): string {
  const parts = summaryHints.filter(Boolean);
  let line = parts.length > 0 ? parts.join(", ") : `Toegewezen: ${displayName}`;
  if (relaxedDate) line += "; niet beschikbaar genegeerd (fallback)";
  if (line.length > 100) line = `${line.slice(0, 97)}…`;
  return line;
}

/**
 * Hoofd-engine: per taak beste vrijwilliger kiezen volgens regels A–G.
 */
export function generateClubPlanning(
  rawTasks: ClubTask[],
  volunteers: VolunteerCandidate[],
  monthlyLoad: Map<string, MonthlyLoad>,
  lastAssigned: Map<string, string | null>,
  monthlySameTeam: Map<string, Map<string, number>> = new Map(),
  volunteerApprovedPoints: Map<string, number> = new Map()
): ClubPlanningOutcome {
  const assignments: ClubPlanningAssignment[] = [];
  const unassigned: Array<{ taskId: string; reason: string }> = [];

  if (volunteers.length === 0) {
    return {
      assignments: [],
      unassigned: rawTasks.map((t) => ({
        taskId: t.id,
        reason: "Geen vrijwilligers in de pool.",
      })),
    };
  }

  const provT = new Map<string, number>();
  const provP = new Map<string, number>();
  const provSameTeam = new Map<string, Map<string, number>>();
  for (const v of volunteers) {
    provT.set(v.profileId, 0);
    provP.set(v.profileId, 0);
  }

  const workingLast = new Map(lastAssigned);

  const poolTasks = rawTasks
    .filter((t) => isTaskPlannable(t.status, t.assigned_to, t.admin_active))
    .map((t) => normalizeClubTask({ ...t }));

  poolTasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    const da = a.task_date ?? "";
    const db = b.task_date ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.title.localeCompare(b.title);
  });

  devLog("[generateClubPlanning] taken in pool:", poolTasks.length, "vrijwilligers:", volunteers.length);

  for (const task of poolTasks) {
    const taskDate = task.task_date ?? defaultTaskDate();

    let pool = volunteers.filter((v) => !isUnavailOnDate(v, taskDate));
    let relaxedDate = false;
    if (pool.length === 0) {
      pool = [...volunteers];
      relaxedDate = true;
    }

    const poolAfterAvail = pool;

    const stdType = normalizeTaskTypeToStandard(task.task_type);
    const vtFiltered = filterVolunteersByTaskRules(pool, stdType, task.team_category ?? null);
    if (vtFiltered.length > 0) {
      pool = vtFiltered;
      devLog(
        "[generateClubPlanning] POOL SIZE:",
        vtFiltered.length,
        "na vrijwilliger-type filter",
        stdType
      );
    }

    if (task.team_id) {
      const tid = String(task.team_id);
      const teamOnly = pool.filter((v) => v.teamIds.has(tid));
      devLog("[generateClubPlanning] POOL SIZE:", teamOnly.length, "na team-filter", tid, "basis-pool", poolAfterAvail.length);
      if (teamOnly.length > 0) {
        pool = teamOnly;
      } else {
        devLog("[generateClubPlanning] geen teamleden in pool — fallback volledige pool (na beschikbaarheid)");
        pool = volunteers.filter((v) => !isUnavailOnDate(v, taskDate));
        if (pool.length === 0) pool = [...volunteers];
      }
    }

    const scored = pool.map((v) => {
      const load = getLoad(monthlyLoad, v.profileId);
      const pt = provT.get(v.profileId) ?? 0;
      const pp = provP.get(v.profileId) ?? 0;
      const sameTeamSoFar = getSameTeamCombined(monthlySameTeam, provSameTeam, v.profileId, task.team_id);
      const approvedPts = volunteerApprovedPoints.get(v.profileId) ?? 0;
      const breakdown = scoreVolunteerForTask(v, { ...task, task_date: taskDate }, load, pt, pp, {
        sameTeamTaskCount: sameTeamSoFar,
        lifetimeApprovedPoints: approvedPts,
      });
      return { v, ...breakdown };
    });

    let picked = scored.filter((s) => !s.unavailable);
    if (picked.length === 0 && scored.length > 0) {
      picked = scored;
      devWarn("[generateClubPlanning] regel G — geen strikte match, beste rest voor taak", task.id);
    }

    const sorted = [...picked].sort((a, b) =>
      compareCandidates(
        { v: a.v, score: a.score, unavailable: a.unavailable },
        { v: b.v, score: b.score, unavailable: b.unavailable },
        monthlyLoad,
        provT,
        provP,
        workingLast
      )
    );

    const winner = sorted[0];
    if (!winner) {
      unassigned.push({ taskId: task.id, reason: "Geen kandidaat gevonden." });
      continue;
    }

    const explanation = formatPlanningExplanation(winner.summaryHints, winner.v.displayName, relaxedDate);

    assignments.push({
      taskId: task.id,
      assignedTo: winner.v.profileId,
      taskDate,
      teamId: task.team_id,
      explanation,
      score: winner.score,
    });

    provT.set(winner.v.profileId, (provT.get(winner.v.profileId) ?? 0) + 1);
    provP.set(winner.v.profileId, (provP.get(winner.v.profileId) ?? 0) + Number(task.points || 0));
    bumpProvSameTeam(provSameTeam, winner.v.profileId, task.team_id);
    workingLast.set(winner.v.profileId, taskDate);
  }

  devLog("[generateClubPlanning] toegewezen:", assignments.length, "open blijven:", unassigned.length);

  return { assignments, unassigned };
}
