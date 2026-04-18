/**
 * @param {string} userId
 * @param {Map<string, { first_name?: string, last_name?: string }>|null|undefined} profileMap
 */
export function getUserName(userId, profileMap) {
  if (!profileMap || !(profileMap instanceof Map)) {
    return "Vrijwilliger";
  }
  const p = profileMap.get(String(userId));
  if (!p) return "Vrijwilliger";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || "Vrijwilliger";
}
