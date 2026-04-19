import { effectiveTaskPoints } from "@/lib/points/effectiveTaskPoints";
import { taskContributesToVolunteerPoints } from "@/lib/planning/taskStatus";

/**
 * Totaal vrijwilligerspunten: alleen goedgekeurde / afgeronde taken (genormaliseerde status, o.a. legacy `voltooid` → completed).
 * Gebruikt effectieve punten (override wint op `points`).
 */
export function calculatePoints(
  tasks: Array<{ status?: string | null; points?: unknown; override_points?: unknown | null }> | null | undefined
): number {
  let sum = 0;
  for (const t of tasks || []) {
    if (!taskContributesToVolunteerPoints(t.status)) continue;
    sum += effectiveTaskPoints(t);
  }
  return Math.round(sum * 10) / 10;
}
