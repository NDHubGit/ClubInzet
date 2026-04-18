import { calculatePoints } from "@/lib/points/calculatePoints";
import { VOLUNTEER_QUOTA_POINTS } from "@/lib/points/volunteerPoints";

export type ProfileLike = {
  id: string;
  email?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  role?: string | null;
};

export type TaskLike = {
  assigned_to?: string | null;
  status?: string | null;
  points?: unknown;
  override_points?: unknown | null;
};


function trimmedOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/**
 * Weergavenaam voor ledenexport/admin.
 * Prioriteit: `name` → `display_name` → `first_name`+`last_name` (alleen als lokaal gezet) → lokaal deel e-mail → "Onbekend".
 */
export function displayNameForProfile(p: ProfileLike): string {
  const fromName = trimmedOrNull(p.name);
  const fromDisplay = trimmedOrNull(p.display_name);
  const fnParts = [trimmedOrNull(p.first_name), trimmedOrNull(p.last_name)].filter(
    (x): x is string => x != null
  );
  const fromFirstLast = fnParts.length > 0 ? fnParts.join(" ").trim() : null;

  const emailRaw = p.email != null ? String(p.email) : "";
  const email = emailRaw.trim();
  const at = email.indexOf("@");
  const fromEmailLocal = at > 0 ? email.slice(0, at).trim() || null : null;

  return fromName ?? fromDisplay ?? fromFirstLast ?? fromEmailLocal ?? "Onbekend";
}

/**
 * Per profiel: aantal toegewezen taken + punten (alleen approved/completed, zie calculatePoints).
 */
export function aggregateMembersByTasks(
  profiles: ProfileLike[],
  tasks: TaskLike[]
): Map<
  string,
  {
    total_tasks: number;
    total_points: number;
  }
> {
  const byUser = new Map<string, TaskLike[]>();
  for (const t of tasks) {
    const aid = t.assigned_to;
    if (aid == null || String(aid).trim() === "") continue;
    const k = String(aid);
    const list = byUser.get(k) ?? [];
    list.push(t);
    byUser.set(k, list);
  }

  const out = new Map<string, { total_tasks: number; total_points: number }>();
  for (const p of profiles) {
    const id = String(p.id);
    const list = byUser.get(id) ?? [];
    const total_tasks = list.length;
    const total_points = calculatePoints(
      list.map((row) => ({
        status: row.status,
        points: row.points,
        override_points: row.override_points,
      }))
    );
    out.set(id, { total_tasks, total_points });
  }
  return out;
}

export function quotaLabel(points: number): "Behaald" | "Niet behaald" {
  return points >= VOLUNTEER_QUOTA_POINTS ? "Behaald" : "Niet behaald";
}

/** Rij voor leden-tabel en CSV-export. */
export type MemberExportRow = {
  id: string;
  name: string;
  email: string | null;
  total_tasks: number;
  total_points: number;
  status: "Behaald" | "Niet behaald";
};

export function buildMemberExportRows(
  profiles: ProfileLike[],
  tasks: TaskLike[],
  options?: { excludeAdmins?: boolean }
): MemberExportRow[] {
  const excludeAdmins = options?.excludeAdmins !== false;
  const list = excludeAdmins ? profiles.filter((p) => String(p.role ?? "").toLowerCase() !== "admin") : profiles;
  const agg = aggregateMembersByTasks(list, tasks);
  return list.map((p) => {
    const id = String(p.id);
    const a = agg.get(id) ?? { total_tasks: 0, total_points: 0 };
    return {
      id,
      name: displayNameForProfile(p),
      email: p.email ?? null,
      total_tasks: a.total_tasks,
      total_points: a.total_points,
      status: quotaLabel(a.total_points),
    };
  });
}
