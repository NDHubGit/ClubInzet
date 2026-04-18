import type { ClubTask, MonthlyLoad, VolunteerCandidate } from "@/lib/planning/clubTypes";
import { normalizeTaskTypeToStandard } from "@/lib/planning/normalizeTaskType";
import { VOLUNTEER_QUOTA_POINTS } from "@/lib/points/volunteerPoints";

/** Weegfactoren (simpel scoringsmodel). */
export const SCORE_TEAM_KOPPELING = 50;
/** Extra team-bonus (naast SCORE_TEAM_KOPPELING). */
export const SCORE_TEAM_MATCH_EXTRA = 10;
export const SCORE_VOORKEUR_TAAK = 20;
/** Extra bonus bij voorkeur (bovenop SCORE_VOORKEUR_TAAK). */
export const SCORE_VOORKEUR_EXTRA = 5;
export const PENALTY_VERHINDERD = -100;
export const PENALTY_BIJNA_MAX = -40;
export const PENALTY_PER_TAAK_DEZE_MAAND = -10;
export const PENALTY_PER_PUNT = -1;
/** Straf per eerdere taak voor hetzelfde team deze maand (inclusief huidige ronde). */
export const PENALTY_PER_ZELFDE_TEAM_TAAK = -5;
/** Kalender: availability.available = false voor deze datum */
export const PENALTY_TABLE_UNAVAILABILITY = -1000;
/** ≥50 goedgekeurde vrijwilligerspunten: minder snel opnieuw ingepland. */
export const PENALTY_VOLUNTEER_QUOTA_MET = -100;

export type ScoreBreakdown = {
  score: number;
  reasons: string[];
  /** Korte leesbare tags voor planning_explanation */
  summaryHints: string[];
  unavailable: boolean;
};

function preferenceMatches(v: VolunteerCandidate, task: ClubTask): boolean {
  if (v.preferredTaskTypes.length === 0) return false;
  const tt = normalizeTaskTypeToStandard(task.task_type);
  return v.preferredTaskTypes.some((raw) => normalizeTaskTypeToStandard(raw) === tt);
}

/**
 * Score voor één vrijwilliger op één taak (Regels B–F + eerlijke verdeling + team-spreiding).
 *
 * Maandbelasting: `totalTasks * PENALTY_PER_TAAK_DEZE_MAAND` komt neer op score -= tasksThisMonth * 10
 * (bestaande logica behouden).
 */
export function scoreVolunteerForTask(
  v: VolunteerCandidate,
  task: ClubTask,
  load: MonthlyLoad,
  /** Provisional extra taken/punten in deze planningsronde */
  provisionalTasks: number,
  provisionalPoints: number,
  options?: {
    /** Al ingeplande taken voor dit team deze maand (DB + prov. in deze run). */
    sameTeamTaskCount?: number;
    /** Som goedgekeurde punten (status completed) — bij ≥ drempel extra straf. */
    lifetimeApprovedPoints?: number;
  }
): ScoreBreakdown {
  const reasons: string[] = [];
  const summaryHints: string[] = [];
  let score = 0;

  const sameTeamTaskCount = Math.max(0, options?.sameTeamTaskCount ?? 0);
  const approvedPts = Math.max(0, options?.lifetimeApprovedPoints ?? 0);

  const taskDate = task.task_date != null ? String(task.task_date).slice(0, 10) : null;
  if (taskDate && v.unavailableDates.includes(taskDate)) {
    return {
      score: PENALTY_VERHINDERD,
      reasons: [`Niet beschikbaar op ${taskDate} (verhinderd).`],
      summaryHints: ["niet beschikbaar"],
      unavailable: true,
    };
  }

  if (taskDate && v.availabilityBlockedDates?.has(taskDate)) {
    score += PENALTY_TABLE_UNAVAILABILITY;
    reasons.push(`${PENALTY_TABLE_UNAVAILABILITY}: niet beschikbaar (kalender) op ${taskDate}.`);
    summaryHints.push("niet beschikbaar (kalender)");
  }

  if (approvedPts >= VOLUNTEER_QUOTA_POINTS) {
    score += PENALTY_VOLUNTEER_QUOTA_MET;
    reasons.push(
      `${PENALTY_VOLUNTEER_QUOTA_MET}: vrijwilligersplicht al voldaan (~${approvedPts.toFixed(1)} pt goedgekeurd).`
    );
    summaryHints.push("vrijwilligersplicht voldaan");
  }

  const teamMatch = Boolean(task.team_id && v.teamIds.has(String(task.team_id)));
  if (teamMatch) {
    score += SCORE_TEAM_KOPPELING;
    score += SCORE_TEAM_MATCH_EXTRA;
    const rel = v.relationByTeam.get(String(task.team_id));
    reasons.push(`+${SCORE_TEAM_KOPPELING}: betrokken bij dit team (${rel ?? "lid"}).`);
    reasons.push(`+${SCORE_TEAM_MATCH_EXTRA}: team match bonus.`);
    summaryHints.push("team match");
  }

  const prefOk = preferenceMatches(v, task);
  if (prefOk) {
    score += SCORE_VOORKEUR_TAAK;
    reasons.push(`+${SCORE_VOORKEUR_TAAK}: voorkeur voor dit type taak (${task.task_type}).`);
    score += SCORE_VOORKEUR_EXTRA;
    reasons.push(`+${SCORE_VOORKEUR_EXTRA}: extra voorkeursbonus.`);
    summaryHints.push("voorkeur");
  }

  const totalTasks = load.taskCount + provisionalTasks;
  const cap = Math.max(0, v.maxTasksPerMonth);
  if (cap > 0 && totalTasks >= cap) {
    return {
      score: PENALTY_VERHINDERD,
      reasons: [`Maandlimiet bereikt (${totalTasks}/${cap}).`],
      summaryHints: ["maandlimiet"],
      unavailable: true,
    };
  }

  if (cap > 0 && totalTasks >= cap - 1) {
    score += PENALTY_BIJNA_MAX;
    reasons.push(`${PENALTY_BIJNA_MAX}: bijna maandlimiet (${totalTasks + 1}/${cap}).`);
  }

  const monthPenalty = totalTasks * PENALTY_PER_TAAK_DEZE_MAAND;
  score += monthPenalty;
  if (monthPenalty !== 0) {
    reasons.push(`${monthPenalty}: al ${totalTasks} ta(a)k(en) deze maand (score -= ${totalTasks}×10).`);
    summaryHints.push("eerlijke verdeling");
  }
  if (totalTasks === 0) {
    summaryHints.push("weinig taken deze maand");
  }

  const sameTeamPenalty = sameTeamTaskCount * PENALTY_PER_ZELFDE_TEAM_TAAK;
  score += sameTeamPenalty;
  if (sameTeamPenalty !== 0) {
    reasons.push(
      `${sameTeamPenalty}: al ${sameTeamTaskCount} ta(a)k(en) voor dit team deze maand.`
    );
    summaryHints.push("spreiding zelfde team");
  }

  const pts = load.pointsSum + provisionalPoints;
  const ptsPenalty = Math.round(pts) * PENALTY_PER_PUNT;
  score += ptsPenalty;
  if (ptsPenalty !== 0) {
    reasons.push(`${ptsPenalty}: puntenbelasting deze maand (~${pts.toFixed(1)} pt).`);
  }

  return { score, reasons, summaryHints: dedupeHints(summaryHints), unavailable: false };
}

function dedupeHints(h: string[]): string[] {
  return [...new Set(h)];
}
