import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureDevTestUsers } from "@/lib/dev/ensureDevTestUsers";

/** 12 accounts: 6 ouders, 2 trainers/leiders, 2 senioren, 1 algemeen, 1 admin */
export const CLUB_REALISTIC_USER_EMAILS = [
  "club.ouder1@test.nl",
  "club.ouder2@test.nl",
  "club.ouder3@test.nl",
  "club.ouder4@test.nl",
  "club.ouder5@test.nl",
  "club.ouder6@test.nl",
  "club.trainer1@test.nl",
  "club.trainer2@test.nl",
  "club.senior1@test.nl",
  "club.senior2@test.nl",
  "club.vrijwilliger@test.nl",
  "club.admin@test.nl",
] as const;

const SEED_DESC = "[club_seed]";

type TeamSeed = { name: string; age_group: string; category: "jeugd" | "senioren" | "mini" | "overig" };

export const CLUB_SEED_TEAMS: TeamSeed[] = [
  { name: "JO8-1", age_group: "JO8", category: "mini" },
  { name: "JO10-1", age_group: "JO10", category: "jeugd" },
  { name: "JO12-1", age_group: "JO12", category: "jeugd" },
  { name: "JO15-1", age_group: "JO15", category: "jeugd" },
  { name: "MO13-1", age_group: "MO13", category: "jeugd" },
  { name: "Senioren 1", age_group: "Senioren", category: "senioren" },
  { name: "35+", age_group: "35+", category: "senioren" },
];

type ProfileSeed = {
  email: string;
  display_name: string;
  volunteer_type: string;
  max_tasks_per_month: number;
  preferred_tasks: string[];
  unavailable_dates: string[];
  role: string;
};

const PROFILE_SEEDS: ProfileSeed[] = [
  {
    email: "club.ouder1@test.nl",
    display_name: "Marieke Jansen",
    volunteer_type: "ouder",
    max_tasks_per_month: 4,
    preferred_tasks: ["bardienst", "keukendienst"],
    unavailable_dates: ["2026-04-12"],
    role: "member",
  },
  {
    email: "club.ouder2@test.nl",
    display_name: "Tom de Vries",
    volunteer_type: "ouder",
    max_tasks_per_month: 3,
    preferred_tasks: ["wedstrijdtafel"],
    unavailable_dates: ["2026-04-19"],
    role: "member",
  },
  {
    email: "club.ouder3@test.nl",
    display_name: "Sanne Bakker",
    volunteer_type: "ouder",
    max_tasks_per_month: 5,
    preferred_tasks: ["schoonmaak", "algemeen"],
    unavailable_dates: [],
    role: "member",
  },
  {
    email: "club.ouder4@test.nl",
    display_name: "Bas Mulder",
    volunteer_type: "ouder",
    max_tasks_per_month: 2,
    preferred_tasks: ["rijdienst"],
    unavailable_dates: ["2026-04-05", "2026-04-26"],
    role: "member",
  },
  {
    email: "club.ouder5@test.nl",
    display_name: "Eva Smit",
    volunteer_type: "ouder",
    max_tasks_per_month: 4,
    preferred_tasks: ["fluitdienst", "algemeen"],
    unavailable_dates: ["2026-04-06"],
    role: "member",
  },
  {
    email: "club.ouder6@test.nl",
    display_name: "Jeroen Koster",
    volunteer_type: "ouder",
    max_tasks_per_month: 3,
    preferred_tasks: ["bardienst"],
    unavailable_dates: [],
    role: "member",
  },
  {
    email: "club.trainer1@test.nl",
    display_name: "Coach Rick",
    volunteer_type: "bestuur",
    max_tasks_per_month: 6,
    preferred_tasks: ["wedstrijdtafel", "fluitdienst"],
    unavailable_dates: ["2026-04-13"],
    role: "member",
  },
  {
    email: "club.trainer2@test.nl",
    display_name: "Trainster Lisa",
    volunteer_type: "bestuur",
    max_tasks_per_month: 5,
    preferred_tasks: ["algemeen", "schoonmaak"],
    unavailable_dates: [],
    role: "member",
  },
  {
    email: "club.senior1@test.nl",
    display_name: "Daan (Senioren)",
    volunteer_type: "senior",
    max_tasks_per_month: 3,
    preferred_tasks: ["bardienst", "keukendienst"],
    unavailable_dates: [],
    role: "member",
  },
  {
    email: "club.senior2@test.nl",
    display_name: "Mark (35+)",
    volunteer_type: "senior",
    max_tasks_per_month: 2,
    preferred_tasks: ["rijdienst", "schoonmaak"],
    unavailable_dates: ["2026-04-18"],
    role: "member",
  },
  {
    email: "club.vrijwilliger@test.nl",
    display_name: "Ans van der Berg",
    volunteer_type: "algemeen",
    max_tasks_per_month: 8,
    preferred_tasks: ["keukendienst", "bardienst", "algemeen"],
    unavailable_dates: [],
    role: "member",
  },
  {
    email: "club.admin@test.nl",
    display_name: "Beheer ClubInzet",
    volunteer_type: "bestuur",
    max_tasks_per_month: 10,
    preferred_tasks: [],
    unavailable_dates: [],
    role: "admin",
  },
];

async function ensureTeam(
  admin: SupabaseClient,
  t: TeamSeed
): Promise<string> {
  const { data: existing } = await admin.from("teams").select("id").eq("name", t.name).maybeSingle();
  if (existing?.id) return String(existing.id);
  const { data, error } = await admin
    .from("teams")
    .insert({ name: t.name, age_group: t.age_group, category: t.category, active: true })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`Team ${t.name}: ${error?.message ?? "geen id"}`);
  return String(data.id);
}

/**
 * Verwijdert eerdere club-seed taken (herkenbaar aan description) en team_members voor seed-profielen.
 */
async function clearPreviousClubSeed(
  admin: SupabaseClient,
  profileIds: string[]
): Promise<void> {
  await admin.from("tasks").delete().like("description", `${SEED_DESC}%`);
  if (profileIds.length > 0) {
    await admin.from("team_members").delete().in("profile_id", profileIds);
  }
}

export type ClubRealisticSeedResult = {
  testUserIds: string[];
  userWarnings: string[];
  teamIds: Record<string, string>;
  tasksInserted: number;
  teamMembersInserted: number;
};

/**
 * Auth-users aanmaken, profielen vullen, teams + koppelingen + ≥20 taken.
 */
export async function seedClubRealisticData(admin: SupabaseClient): Promise<ClubRealisticSeedResult> {
  const { ids: testUserIds, warnings: userWarnings } = await ensureDevTestUsers(admin, CLUB_REALISTIC_USER_EMAILS);

  const { data: profRows } = await admin.from("profiles").select("id, email").in("email", [...CLUB_REALISTIC_USER_EMAILS]);
  const emailToId = new Map<string, string>();
  for (const p of profRows || []) {
    if (p.email) emailToId.set(String(p.email).toLowerCase(), String(p.id));
  }

  const profileIds = [...emailToId.values()];
  await clearPreviousClubSeed(admin, profileIds);

  for (const s of PROFILE_SEEDS) {
    const id = emailToId.get(s.email.toLowerCase());
    if (!id) {
      userWarnings.push(`Geen profiel voor ${s.email} — overslaan.`);
      continue;
    }
    const first = s.display_name.split(/\s+/)[0] ?? s.display_name;
    const { error } = await admin.from("profiles").upsert(
      {
        id,
        email: s.email,
        first_name: first,
        last_name: s.display_name.split(/\s+/).slice(1).join(" ") || null,
        display_name: s.display_name,
        role: s.role,
        active: true,
        volunteer_type: s.volunteer_type,
        max_tasks_per_month: s.max_tasks_per_month,
        preferred_tasks: s.preferred_tasks,
        unavailable_dates: s.unavailable_dates,
      },
      { onConflict: "id" }
    );
    if (error) userWarnings.push(`Profiel ${s.email}: ${error.message}`);
  }

  const teamIds: Record<string, string> = {};
  for (const t of CLUB_SEED_TEAMS) {
    teamIds[t.name] = await ensureTeam(admin, t);
  }

  type M = { profileEmail: string; teamName: string; relation_type: "speler" | "ouder" | "trainer" | "leider" };
  const memberRows: M[] = [
    { profileEmail: "club.ouder1@test.nl", teamName: "JO10-1", relation_type: "ouder" },
    { profileEmail: "club.ouder2@test.nl", teamName: "JO8-1", relation_type: "ouder" },
    { profileEmail: "club.ouder3@test.nl", teamName: "JO12-1", relation_type: "ouder" },
    { profileEmail: "club.ouder4@test.nl", teamName: "JO15-1", relation_type: "ouder" },
    { profileEmail: "club.ouder5@test.nl", teamName: "MO13-1", relation_type: "ouder" },
    { profileEmail: "club.ouder6@test.nl", teamName: "JO10-1", relation_type: "ouder" },
    { profileEmail: "club.trainer1@test.nl", teamName: "JO10-1", relation_type: "trainer" },
    { profileEmail: "club.trainer2@test.nl", teamName: "JO12-1", relation_type: "leider" },
    { profileEmail: "club.senior1@test.nl", teamName: "Senioren 1", relation_type: "speler" },
    { profileEmail: "club.senior2@test.nl", teamName: "35+", relation_type: "speler" },
  ];

  let teamMembersInserted = 0;
  for (const m of memberRows) {
    const pid = emailToId.get(m.profileEmail.toLowerCase());
    const teamId = teamIds[m.teamName];
    if (!pid || !teamId) continue;
    const { error } = await admin.from("team_members").insert({
      team_id: teamId,
      profile_id: pid,
      relation_type: m.relation_type,
    });
    if (!error) teamMembersInserted += 1;
    else if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
      userWarnings.push(`team_members ${m.profileEmail}: ${error.message}`);
    }
  }

  const poolUserId =
    emailToId.get("club.vrijwilliger@test.nl") ??
    emailToId.get("club.ouder1@test.nl") ??
    testUserIds[0] ??
    null;
  if (!poolUserId) {
    throw new Error("Geen pool user_id voor taken — seed mislukt.");
  }

  const taskDate = (d: string) => d;

  const taskTemplates: Array<{
    title: string;
    task_type: string;
    teamName: string | null;
    task_date: string;
    duration_minutes: number;
    points: number;
    priority: "laag" | "normaal" | "hoog";
    start_time?: string | null;
    end_time?: string | null;
    description: string;
  }> = [
    {
      title: "Bardienst zaterdag ochtend",
      task_type: "bardienst",
      teamName: null,
      task_date: taskDate("2026-04-05"),
      duration_minutes: 180,
      points: 2,
      priority: "hoog",
      start_time: "09:00",
      end_time: "12:00",
      description: `${SEED_DESC} Kantine open, tappen, kassa.`,
    },
    {
      title: "Bardienst zaterdag middag",
      task_type: "bardienst",
      teamName: null,
      task_date: taskDate("2026-04-05"),
      duration_minutes: 240,
      points: 2.5,
      priority: "normaal",
      start_time: "12:00",
      end_time: "16:00",
      description: `${SEED_DESC} Middagdienst kantine.`,
    },
    {
      title: "Wedstrijdtafel JO10",
      task_type: "wedstrijdtafel",
      teamName: "JO10-1",
      task_date: taskDate("2026-04-06"),
      duration_minutes: 90,
      points: 1.5,
      priority: "hoog",
      description: `${SEED_DESC} Inschrijven, fluitjes, wedstrijdformulier.`,
    },
    {
      title: "Kleedkamercontrole jeugd",
      task_type: "algemeen",
      teamName: "JO12-1",
      task_date: taskDate("2026-04-06"),
      duration_minutes: 45,
      points: 1,
      priority: "normaal",
      description: `${SEED_DESC} Check schoonmaak kleedkamers na wedstrijd.`,
    },
    {
      title: "Schoonmaak kantine (groot)",
      task_type: "schoonmaak",
      teamName: null,
      task_date: taskDate("2026-04-07"),
      duration_minutes: 120,
      points: 2,
      priority: "normaal",
      description: `${SEED_DESC} Vloer, bar, glazen.`,
    },
    {
      title: "Fluiten jeugdwedstrijd",
      task_type: "fluitdienst",
      teamName: "JO8-1",
      task_date: taskDate("2026-04-12"),
      duration_minutes: 60,
      points: 1.5,
      priority: "hoog",
      description: `${SEED_DESC} Mini's fluiten (4x10 min).`,
    },
    {
      title: "Rijden uitwedstrijd MO13",
      task_type: "rijdienst",
      teamName: "MO13-1",
      task_date: taskDate("2026-04-13"),
      duration_minutes: 180,
      points: 2,
      priority: "hoog",
      description: `${SEED_DESC} Busje + chauffeur.`,
    },
    {
      title: "Ontvangst scheidsrechter",
      task_type: "algemeen",
      teamName: null,
      task_date: taskDate("2026-04-13"),
      duration_minutes: 30,
      points: 0.5,
      priority: "normaal",
      description: `${SEED_DESC} Welkom, kleedkamer, drankje.`,
    },
    {
      title: "Keuken lunch zondag",
      task_type: "keukendienst",
      teamName: null,
      task_date: taskDate("2026-04-14"),
      duration_minutes: 150,
      points: 2,
      priority: "normaal",
      start_time: "10:30",
      end_time: "13:00",
      description: `${SEED_DESC} Snacks voor toeschouwers.`,
    },
    {
      title: "Bardienst zondag",
      task_type: "bardienst",
      teamName: null,
      task_date: taskDate("2026-04-14"),
      duration_minutes: 180,
      points: 2,
      priority: "normaal",
      description: `${SEED_DESC} Zondagse thuiswedstrijd.`,
    },
    {
      title: "Wedstrijdtafel JO15",
      task_type: "wedstrijdtafel",
      teamName: "JO15-1",
      task_date: taskDate("2026-04-19"),
      duration_minutes: 90,
      points: 1.5,
      priority: "hoog",
      description: `${SEED_DESC} Tafel + wedstrijdleiding.`,
    },
    {
      title: "Schoonmaak kleedkamer senioren",
      task_type: "schoonmaak",
      teamName: "Senioren 1",
      task_date: taskDate("2026-04-19"),
      duration_minutes: 60,
      points: 1,
      priority: "laag",
      description: `${SEED_DESC} Na thuiswedstrijd.`,
    },
    {
      title: "Keukendienst vrijdagavond",
      task_type: "keukendienst",
      teamName: null,
      task_date: taskDate("2026-04-18"),
      duration_minutes: 120,
      points: 1.5,
      priority: "normaal",
      start_time: "18:00",
      end_time: "20:00",
      description: `${SEED_DESC} Eten jeugdtraining.`,
    },
    {
      title: "Fluitdienst oefenwedstrijd",
      task_type: "fluitdienst",
      teamName: "JO12-1",
      task_date: taskDate("2026-04-20"),
      duration_minutes: 90,
      points: 1.5,
      priority: "normaal",
      description: `${SEED_DESC} Reserve fluit beschikbaar.`,
    },
    {
      title: "Rijden 35+ uit",
      task_type: "rijdienst",
      teamName: "35+",
      task_date: taskDate("2026-04-21"),
      duration_minutes: 150,
      points: 2,
      priority: "normaal",
      description: `${SEED_DESC} Carpool senioren.`,
    },
    {
      title: "Wedstrijdtafel mini's",
      task_type: "wedstrijdtafel",
      teamName: "JO8-1",
      task_date: taskDate("2026-04-22"),
      duration_minutes: 60,
      points: 1,
      priority: "normaal",
      description: `${SEED_DESC} Mini-toernooi.`,
    },
    {
      title: "Algemene klus veld",
      task_type: "algemeen",
      teamName: null,
      task_date: taskDate("2026-04-23"),
      duration_minutes: 90,
      points: 1,
      priority: "laag",
      description: `${SEED_DESC} Doelen verplaatsen, netten.`,
    },
    {
      title: "Bardienst donderdag training",
      task_type: "bardienst",
      teamName: null,
      task_date: taskDate("2026-04-24"),
      duration_minutes: 120,
      points: 1.5,
      priority: "laag",
      start_time: "18:30",
      end_time: "20:30",
      description: `${SEED_DESC} Drank na training.`,
    },
    {
      title: "Schoonmaak bestuurskamer",
      task_type: "schoonmaak",
      teamName: null,
      task_date: taskDate("2026-04-25"),
      duration_minutes: 60,
      points: 1,
      priority: "laag",
      description: `${SEED_DESC} Stofzuigen, bureau.`,
    },
    {
      title: "Kassa entree senioren",
      task_type: "algemeen",
      teamName: "Senioren 1",
      task_date: taskDate("2026-04-26"),
      duration_minutes: 120,
      points: 1.5,
      priority: "normaal",
      description: `${SEED_DESC} Entree + parkeer.`,
    },
    {
      title: "Keuken + bardienst combinatie",
      task_type: "keukendienst",
      teamName: null,
      task_date: taskDate("2026-04-27"),
      duration_minutes: 240,
      points: 3,
      priority: "hoog",
      description: `${SEED_DESC} Drukke dubbele header.`,
    },
  ];

  const insertRows = taskTemplates.map((x) => ({
    user_id: poolUserId,
    task_type: x.task_type,
    title: x.title,
    description: x.description,
    team_id: x.teamName ? teamIds[x.teamName] ?? null : null,
    task_date: x.task_date,
    start_time: x.start_time ?? null,
    end_time: x.end_time ?? null,
    duration_minutes: x.duration_minutes,
    points: x.points,
    priority: x.priority,
    status: "planned",
    flagged: false,
    assigned_to: null,
    notification_sent: false,
  }));

  const { data: ins, error: insErr } = await admin.from("tasks").insert(insertRows).select("id");

  if (insErr) {
    throw new Error(insErr.message);
  }

  return {
    testUserIds,
    userWarnings,
    teamIds,
    tasksInserted: ins?.length ?? insertRows.length,
    teamMembersInserted,
  };
}
