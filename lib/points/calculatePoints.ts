import { effectiveTaskPoints } from "@/lib/points/effectiveTaskPoints";

const POINT_COUNT_STATUSES = new Set(["approved", "completed"]);

/**
 * Totaal vrijwilligerspunten: alleen goedgekeurde / afgeronde taken.
 * Gebruikt effectieve punten (override wint op `points`).
 */
export function calculatePoints(
  tasks: Array<{ status?: string | null; points?: unknown; override_points?: unknown | null }> | null | undefined
): number {
  let sum = 0;
  for (const t of tasks || []) {
    const st = String(t.status ?? "").toLowerCase();
    if (!POINT_COUNT_STATUSES.has(st)) continue;
    sum += effectiveTaskPoints(t);
  }
  return Math.round(sum * 10) / 10;
}
