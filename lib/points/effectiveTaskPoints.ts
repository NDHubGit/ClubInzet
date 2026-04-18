/** Effectieve punten: admin-override wint op `points`. */
export function effectiveTaskPoints(row: { points?: unknown; override_points?: unknown | null }): number {
  const o = row.override_points;
  if (o != null && o !== "" && Number.isFinite(Number(o))) return Number(o);
  const p = Number(row.points);
  return Number.isFinite(p) ? p : 0;
}
