/**
 * Mapt ruwe API/Postgres-fouten naar begrijpelijke NL-tekst voor taaktype-beheer (RLS/rechten).
 */
export function formatTaskTypeRuleMutationError(raw: string): string {
  const s = raw.toLowerCase();
  if (
    s.includes("row-level security") ||
    s.includes("violates row-level security") ||
    s.includes("new row violates") ||
    (s.includes("policy") && (s.includes("violat") || s.includes("denied")))
  ) {
    return "Je hebt geen rechten om taaktypes te beheren. Controleer je adminrol en of de server de service role key gebruikt.";
  }
  if (s.includes("permission denied") || s.includes("42501")) {
    return "Je hebt geen rechten om taaktypes te beheren.";
  }
  if (s.includes("forbidden") || s.includes("403")) {
    return "Je hebt geen rechten om taaktypes te beheren.";
  }
  return raw;
}
