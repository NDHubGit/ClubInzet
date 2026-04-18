/**
 * Types voor club-/verenigingsplanning (los van legacy generatePlanning).
 */

export type VolunteerType = "ouder" | "speler" | "senior" | "bestuur" | "algemeen";

export type TeamCategory = "jeugd" | "senioren" | "mini" | "overig";

export type TeamRelationType = "speler" | "ouder" | "trainer" | "leider";

export type ClubTaskType =
  | "bardienst"
  | "schoonmaak"
  | "wedstrijdtafel"
  | "rijdienst"
  | "keukendienst"
  | "fluitdienst"
  | "algemeen";

export type TaskPriority = "laag" | "normaal" | "hoog";

export type TaskStatus =
  | "open"
  | "claimed"
  | "pending"
  | "completed"
  | "rejected"
  | "missed"
  | "approved"
  /** legacy */
  | "assigned"
  | "no_show"
  | "ingepland"
  | "bevestigd"
  | "voltooid";

/** Taak zoals de planningsengine hem nodig heeft (subset DB + normalisatie). */
export type ClubTask = {
  id: string;
  title: string;
  task_type: string;
  team_id: string | null;
  /** optioneel: teams.category voor jeugd/senioren-regels */
  team_category?: string | null;
  task_date: string | null;
  duration_minutes: number;
  points: number;
  priority: TaskPriority;
  status: TaskStatus;
  user_id: string;
  assigned_to?: string | null;
  /** false = niet in pool/planning; ontbrekend/true = normaal */
  admin_active?: boolean | null;
};

export type VolunteerCandidate = {
  profileId: string;
  displayName: string;
  email: string | null;
  role: string | null;
  volunteerType: string;
  active: boolean;
  maxTasksPerMonth: number;
  unavailableDates: string[];
  /** Datums met available=false in availability-tabel */
  availabilityBlockedDates: Set<string>;
  preferredTaskTypes: string[];
  /** Teams waar deze persoon bij hoort */
  teamIds: Set<string>;
  /** team_id -> relation */
  relationByTeam: Map<string, TeamRelationType>;
};

export type MonthlyLoad = {
  taskCount: number;
  pointsSum: number;
};

export type ClubPlanningAssignment = {
  taskId: string;
  assignedTo: string;
  taskDate: string;
  teamId: string | null;
  explanation: string;
  score: number;
};

export type ClubPlanningOutcome = {
  assignments: ClubPlanningAssignment[];
  /** Taken waarvoor niemand kon worden gekozen (leeg na filter + geen fallback) */
  unassigned: Array<{ taskId: string; reason: string }>;
};
