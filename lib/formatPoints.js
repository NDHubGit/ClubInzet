/** Afronden op 1 decimaal (weergave & consistentie met API). */
export function roundPoints1(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10) / 10;
}

export function formatPoints1Str(n) {
  return roundPoints1(n).toFixed(1);
}

/** "punt" / "punten" voor getoonde waarde (1 decimaal). */
export function puntwoordVoorDisplay(n) {
  const v = roundPoints1(n);
  const whole = Math.abs(v - Math.round(v)) < 0.05;
  if (whole && Math.round(v) === 1) return "punt";
  if (whole && Math.round(v) >= 2) return "punten";
  return "punt";
}

/** Bijv. "32 min • 0.5 punt" */
export function formatDuurPuntRegel(durationMinutes, pointsValue) {
  const m = Number(durationMinutes);
  const pm = Number.isFinite(m) ? Math.round(m) : 0;
  const pr = roundPoints1(pointsValue);
  return `${pm} min • ${pr.toFixed(1)} ${puntwoordVoorDisplay(pr)}`;
}
