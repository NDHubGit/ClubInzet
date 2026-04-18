/** Standaard duur (minuten) en afgeleide punten voor handmatige invoer. */
export const MANUAL_TASK_TYPE_OPTIONS = ["Bar", "Training", "Schoonmaak", "Overig"] as const;

/** Opties voor handmatige bijdrage op /user (API `task_type`). */
export const USER_MANUAL_CONTRIBUTION_OPTIONS = [
  { value: "bardienst", label: "Bardienst" },
  { value: "training", label: "Training" },
  { value: "wedstrijd", label: "Wedstrijd" },
  { value: "schoonmaak", label: "Schoonmaak" },
  { value: "anders", label: "Anders" },
] as const;

export function defaultMinutesForTaskType(taskType: string): number {
  const m: Record<string, number> = {
    Bar: 60,
    Training: 90,
    Schoonmaak: 60,
    Overig: 60,
    bardienst: 120,
    training: 90,
    wedstrijd: 120,
    schoonmaak: 60,
    anders: 60,
  };
  return m[taskType] ?? 60;
}

export function pointsFromDurationMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 1000) / 1000;
}
