/** Club-task statussen (database + API). */
export type ClubTaskLifecycleStatus =
  | "open"
  | "planned"
  | "claimed"
  | "completed"
  | "missed"
  | "approved"
  | "pending"
  | "rejected";

const LEGACY_MAP: Record<string, ClubTaskLifecycleStatus> = {
  ingepland: "claimed",
  bevestigd: "claimed",
  voltooid: "completed",
  open: "open",
  planned: "planned",
  assigned: "claimed",
  claimed: "claimed",
  pending: "pending",
  completed: "completed",
  rejected: "rejected",
  no_show: "missed",
  missed: "missed",
  approved: "approved",
};

export function normalizeTaskStatus(raw: string | null | undefined): ClubTaskLifecycleStatus {
  const s = String(raw ?? "open").toLowerCase().trim();
  if (LEGACY_MAP[s]) return LEGACY_MAP[s];
  if (s === "pending" || s === "rejected") return s as ClubTaskLifecycleStatus;
  if (s === "planned") return "planned";
  if (s === "completed" || s === "missed" || s === "claimed" || s === "approved") return s as ClubTaskLifecycleStatus;
  return "open";
}

/**
 * Mag in de planningspool (geen toewijzing; status open of planned — legacy `open` blijft ondersteund).
 * `admin_active === false` sluit de taak uit (verborgen voor pool/planning); ontbrekend = actief.
 */
export function isTaskPlannable(
  status: string | null | undefined,
  assignedTo: string | null | undefined,
  adminActive?: boolean | null
): boolean {
  if (adminActive === false) return false;
  if (assignedTo != null && String(assignedTo).trim() !== "") return false;
  const n = normalizeTaskStatus(status);
  return n === "open" || n === "planned";
}

/** Actieve claim op een taak (legacy `assigned` wordt als claimed gezien). */
export function isClaimedStatus(raw: string | null | undefined): boolean {
  return normalizeTaskStatus(raw) === "claimed";
}

/** Punten / klassement: alleen goedgekeurd (handmatig) of afgerond (claim-flow). */
export function taskContributesToVolunteerPoints(raw: string | null | undefined): boolean {
  const n = normalizeTaskStatus(raw);
  return n === "approved" || n === "completed";
}

/**
 * Home “Je taken”-preview: claim, goedgekeurd, afgerond + handmatige pending (wacht op admin).
 */
export function taskShowsInUserDashboardPreview(
  raw: string | null | undefined,
  source: string | null | undefined
): boolean {
  const n = normalizeTaskStatus(raw);
  const src = String(source ?? "").toLowerCase().trim();
  if (n === "pending" && src === "manual") return true;
  return n === "claimed" || n === "approved" || n === "completed";
}
