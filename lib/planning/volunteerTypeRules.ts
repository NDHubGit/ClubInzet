import type { VolunteerCandidate } from "@/lib/planning/clubTypes";
import type { StandardTaskType } from "@/lib/planning/normalizeTaskType";

/** Map legacy profiel-waarden naar standaard voor matching. */
export function normalizeVolunteerTypeForRules(raw: string | null | undefined): string {
  const s = String(raw ?? "vrijwilliger").toLowerCase().trim();
  const map: Record<string, string> = {
    algemeen: "vrijwilliger",
    senior: "speler",
    bestuur: "trainer",
    vrijwilliger: "vrijwilliger",
    ouder: "ouder",
    speler: "speler",
    trainer: "trainer",
  };
  return map[s] ?? s;
}

function isYouthTeamCategory(category: string | null | undefined): boolean {
  const c = String(category ?? "").toLowerCase();
  return c === "jeugd" || c === "mini";
}

/**
 * Verkleint de pool op basis van taaktype + team; lege output = caller valt terug op vorige pool.
 */
export function filterVolunteersByTaskRules(
  volunteers: VolunteerCandidate[],
  taskType: StandardTaskType,
  teamCategory: string | null | undefined
): VolunteerCandidate[] {
  const withNorm = volunteers.map((v) => ({
    v,
    vt: normalizeVolunteerTypeForRules(v.volunteerType),
  }));

  if (taskType === "training") {
    const f = withNorm.filter((x) => x.vt === "trainer").map((x) => x.v);
    return f.length ? f : volunteers;
  }

  if (taskType === "bar" && isYouthTeamCategory(teamCategory)) {
    const f = withNorm.filter((x) => x.vt === "ouder").map((x) => x.v);
    return f.length ? f : volunteers;
  }

  if (taskType === "schoonmaak") {
    const f = withNorm.filter((x) => x.vt !== "trainer").map((x) => x.v);
    return f.length ? f : volunteers;
  }

  return volunteers;
}
