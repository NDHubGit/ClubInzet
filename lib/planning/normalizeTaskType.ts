/**
 * Standaard task_type-waarden: bar | training | match | schoonmaak | algemeen
 */
export type StandardTaskType = "bar" | "training" | "match" | "schoonmaak" | "algemeen";

const TO_STANDARD: Record<string, StandardTaskType> = {
  bar: "bar",
  bardienst: "bar",
  keukendienst: "bar",
  training: "training",
  match: "match",
  wedstrijd: "match",
  wedstrijdtafel: "match",
  fluitdienst: "match",
  schoonmaak: "schoonmaak",
  algemeen: "algemeen",
  rijdienst: "algemeen",
  "club dienst": "algemeen",
};

export function normalizeTaskTypeToStandard(raw: string | null | undefined): StandardTaskType {
  const k = String(raw ?? "algemeen")
    .toLowerCase()
    .trim();
  if (TO_STANDARD[k]) return TO_STANDARD[k];
  const hit = Object.keys(TO_STANDARD).find((x) => k.includes(x));
  if (hit && TO_STANDARD[hit]) return TO_STANDARD[hit];
  return "algemeen";
}
