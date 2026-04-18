/**
 * Teamhelpers — teams komen uit Supabase (`teams`-tabel).
 */

export function getTeamName(teamId, teams) {
  if (teamId == null || teamId === "") return null;
  const list = teams || [];
  const t = list.find((x) => String(x.id) === String(teamId));
  return t ? t.name : null;
}

/** @param {{ id: string, team_id?: string|null }[]} roster */
export function teamIdForUser(userId, roster) {
  const u = (roster || []).find((x) => String(x.id) === String(userId));
  return u?.team_id != null && u.team_id !== "" ? String(u.team_id) : null;
}

/** Profielen uit DB → roster voor teamIdForUser */
export function profilesForTeamRoster(profiles) {
  return (profiles || []).map((p) => ({ id: p.id, team_id: p.team_id }));
}

/** Profielen → Map voor getUserName */
export function profilesToMap(profiles) {
  const m = new Map();
  for (const p of profiles || []) {
    m.set(String(p.id), {
      first_name: p.first_name,
      last_name: p.last_name,
    });
  }
  return m;
}
