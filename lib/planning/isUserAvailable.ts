import { isUserAvailableOnDate } from "@/lib/planning/availabilityDb";

/**
 * @param blockedDates — datums met `available = false` in de availability-tabel (per gebruiker).
 * Geen rij = beschikbaar (default true).
 */
export function isUserAvailable(blockedDates: Set<string> | undefined, dateIso: string): boolean {
  return isUserAvailableOnDate(blockedDates, dateIso);
}
