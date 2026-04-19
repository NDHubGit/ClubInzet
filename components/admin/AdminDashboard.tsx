"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { formatPoints1Str } from "@/lib/formatPoints";
import { supabase } from "@/lib/supabase";
import { normalizeTaskStatus, taskContributesToVolunteerPoints } from "@/lib/planning/taskStatus";
import { getStatusLabel } from "@/lib/tasks/statusConfig";
import { effectiveTaskPoints, VOLUNTEER_QUOTA_POINTS } from "@/lib/points/volunteerPoints";
import type { MemberExportRow } from "@/lib/admin/aggregateMembers";

import { ADMIN_API_FETCH_BASE, getAccessTokenForAdminRoutes } from "./adminRouteFetch";
import AdminPanel from "./AdminPanel";

export type AdminMe = {
  id: string;
  email?: string;
  role?: string;
};

type ProfileRow = {
  id: string;
  email?: string | null;
  /** Weergavenaam in admin (kolom “In afwachting” / gebruiker). */
  name?: string | null;
  /** Niet in runtime-DB-schema; kan ontbreken of uit oudere payloads komen. */
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  role?: string | null;
};

type TaskRow = {
  id: string;
  title?: string | null;
  task_type?: string | null;
  task_date?: string | null;
  /** Optioneel: alleen als migratie `003_push_reminders.sql` is toegepast. */
  task_due_at?: string | null;
  start_time?: string | null;
  created_at?: string | null;
  user_id?: string;
  assigned_to?: string | null;
  team_id?: string | null;
  duration_minutes?: number;
  points?: number;
  flagged?: boolean;
  status?: string | null;
  planning_explanation?: string | null;
  completed_at?: string | null;
  source?: string | null;
  description?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  override_points?: number | null;
  /** Na migratie admin-taken; ontbrekend = actief in pool. */
  admin_active?: boolean | null;
  /** Alleen van GET /api/admin/review-tasks: profiel van indiener (server-side join). */
  assignee_profile?: ProfileRow | null;
  created_by?: string | null;
};

function trimmedOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** Zelfde prioriteit als `displayNameForProfile` (export), zonder crash op null/leeg. */
function adminMemberDisplayName(
  map: Map<string, ProfileRow>,
  userId: string | null | undefined,
  inlineProfile?: ProfileRow | null
): string {
  const p = inlineProfile ?? (userId && String(userId).trim() !== "" ? map.get(String(userId)) : undefined);
  if (!p) {
    if (userId && String(userId).trim() !== "") return `Gebruiker ${truncateId(String(userId))}`;
    return "Onbekend";
  }

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
  const fromFullEmail = email.length > 0 ? email : null;

  return fromName ?? fromDisplay ?? fromFirstLast ?? fromEmailLocal ?? fromFullEmail ?? "Onbekend";
}

function truncateId(id: string | null | undefined, head = 6): string {
  if (!id) return "—";
  const s = String(id);
  return s.length > head + 2 ? `${s.slice(0, head)}…` : s;
}

/** Zelfde volgorde als server review-tasks: toegewezen → eigenaar → maker. */
function submitterUserIdForTask(t: TaskRow): string | null {
  if (t.assigned_to != null && String(t.assigned_to).trim() !== "") return String(t.assigned_to);
  if (t.user_id != null && String(t.user_id).trim() !== "") return String(t.user_id);
  if (t.created_by != null && String(t.created_by).trim() !== "") return String(t.created_by);
  return null;
}

function formatTaskDate(t: TaskRow): string {
  if (t.task_date != null && String(t.task_date).trim() !== "") {
    const day = String(t.task_date).slice(0, 10);
    const rawSt = t.start_time;
    const st =
      rawSt != null && String(rawSt).trim() !== "" ? String(rawSt).trim().slice(0, 5) : "";
    return st ? `${day} ${st}` : day;
  }
  if (t.task_due_at != null && String(t.task_due_at).trim() !== "") {
    return String(t.task_due_at).slice(0, 16).replace("T", " ");
  }
  if (t.created_at != null && String(t.created_at).trim() !== "") {
    return String(t.created_at).slice(0, 10);
  }
  return "—";
}

function shortExplain(text: string | null | undefined, max = 100): string {
  const s = text?.trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function manualFlowHint(t: TaskRow): string | null {
  if (String(t.source ?? "") !== "manual") return null;
  const n = normalizeTaskStatus(t.status);
  if (n === "pending") return "Zelf ingevoerd, wacht op goedkeuring";
  if (n === "approved" || n === "completed") return "Goedgekeurd door admin";
  if (n === "rejected") return "Afgekeurd door admin";
  return null;
}

function adminApiSliceErrorMessage(res: Response, j: { error?: string; message?: string }): string {
  const code = j.error;
  if (res.status === 503 || code === "ADMIN_SERVER_CONFIG") {
    return j.message?.trim() || "Admin serverconfiguratie ontbreekt.";
  }
  if (res.status === 403 || code === "ADMIN_AUTH_FORBIDDEN") {
    return "Geen adminrechten op deze server voor jouw account. Vernieuw de pagina of log opnieuw in.";
  }
  if (res.status === 401) {
    return "Niet ingelogd voor dit onderdeel. Vernieuw de pagina.";
  }
  if (
    res.status >= 500 ||
    code === "SUPABASE_QUERY_ERROR" ||
    code === "UNEXPECTED" ||
    code === "ADMIN_AUTH_CHECK_FAILED"
  ) {
    return `Serverfout (${res.status}). Probeer opnieuw of meld dit bij de beheerder.`;
  }
  const raw = j.message?.trim() || j.error?.trim() || "";
  if (raw && raw !== "Internal Server Error") return raw;
  return `Kon gegevens niet laden (fout ${res.status}).`;
}

export type AdminDashboardProps = {
  me: AdminMe;
};

export default function AdminDashboard({ me }: AdminDashboardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profilesMap, setProfilesMap] = useState(() => new Map<string, ProfileRow>());
  const [loading, setLoading] = useState(true);
  const [planningMsg, setPlanningMsg] = useState<string | null>(null);
  const [taskActionBusy, setTaskActionBusy] = useState<string | null>(null);
  const [manualReviewBusy, setManualReviewBusy] = useState<string | null>(null);
  const [pointsSaveBusy, setPointsSaveBusy] = useState<string | null>(null);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});
  const [availDate, setAvailDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [availNotThere, setAvailNotThere] = useState(true);
  const [availBusy, setAvailBusy] = useState(false);
  const [availMsg, setAvailMsg] = useState<string | null>(null);

  /** Ledenoverzicht (API, geaggregeerd). */
  const [memberRows, setMemberRows] = useState<MemberExportRow[]>([]);
  const [memberSummaryLoading, setMemberSummaryLoading] = useState(false);
  const [memberSummaryError, setMemberSummaryError] = useState<string | null>(null);

  /** Review-wachtrij: alleen openstaande handmatige taken (pending + manual), server-side. */
  const [reviewTasks, setReviewTasks] = useState<TaskRow[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewTasksError, setReviewTasksError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    const [tasksRes, profRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
    ]);

    if (tasksRes.error) console.error(tasksRes.error);
    setTasks((Array.isArray(tasksRes.data) ? tasksRes.data : []) as TaskRow[]);

    const m = new Map<string, ProfileRow>();
    if (!profRes.error && Array.isArray(profRes.data)) {
      for (const p of profRes.data as ProfileRow[]) {
        m.set(String(p.id), p);
      }
    }
    setProfilesMap(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /** Goedgekeurd of afgerond (punten tellen mee). */
  const approvedTasksCount = useMemo(() => {
    return tasks.filter((t) => taskContributesToVolunteerPoints(t.status)).length;
  }, [tasks]);

  /** Top 5 leden op totaalpunten (zelfde bron als export). */
  const memberRowsTop5 = useMemo(() => {
    return [...memberRows]
      .sort((a, b) => b.total_points - a.total_points || b.total_tasks - a.total_tasks)
      .slice(0, 5);
  }, [memberRows]);

  const shell: CSSProperties = {
    minHeight: "100vh",
    background: "#020617",
    color: "#e2e8f0",
    padding: "16px",
    paddingBottom: 32,
  };

  const card: CSSProperties = {
    padding: 16,
    borderRadius: 12,
    background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  const btnPrimary: CSSProperties = {
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  };

  const btnGhost: CSSProperties = {
    ...btnPrimary,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#e2e8f0",
  };

  const effectiveRole = useMemo(() => {
    const fromProfile = profilesMap.get(me.id)?.role ?? me.role;
    if (typeof fromProfile === "string" && fromProfile.trim() !== "") {
      return fromProfile.trim();
    }
    return "user";
  }, [profilesMap, me.id, me.role]);

  const isAdmin = effectiveRole.toLowerCase() === "admin";

  /**
   * Eén token + parallel fetch: zelfde auth-context als `AdminTaskTypesPanel` (getUser → sessietoken).
   */
  const loadAdminDashboardSlices = useCallback(async () => {
    setMemberSummaryLoading(true);
    setReviewLoading(true);
    setMemberSummaryError(null);
    setReviewTasksError(null);
    try {
      const token = await getAccessTokenForAdminRoutes();
      if (!token) {
        const msg = "Geen geldige sessie voor admin-API. Vernieuw de pagina of log opnieuw in.";
        setMemberSummaryError(msg);
        setReviewTasksError(msg);
        setMemberRows([]);
        setReviewTasks([]);
        return;
      }
      const headers = new Headers({ Authorization: `Bearer ${token}` });
      const init: RequestInit = { ...ADMIN_API_FETCH_BASE, headers };
      const q = new URLSearchParams();
      q.set("status", "pending");
      q.set("source", "manual");
      const [mRes, rRes] = await Promise.all([
        fetch("/api/admin/members-summary", init),
        fetch(`/api/admin/review-tasks?${q.toString()}`, init),
      ]);

      const mj = (await mRes.json().catch(() => ({}))) as {
        rows?: MemberExportRow[];
        error?: string;
        message?: string;
      };
      if (!mRes.ok) {
        setMemberSummaryError(adminApiSliceErrorMessage(mRes, mj));
        setMemberRows([]);
      } else {
        setMemberRows(Array.isArray(mj.rows) ? mj.rows : []);
      }

      const rj = (await rRes.json().catch(() => ({}))) as { tasks?: TaskRow[]; error?: string; message?: string };
      if (!rRes.ok) {
        setReviewTasksError(adminApiSliceErrorMessage(rRes, rj));
        setReviewTasks([]);
      } else {
        const list = (Array.isArray(rj.tasks) ? rj.tasks : []) as TaskRow[];
        const filtered = list.filter(
          (t) =>
            normalizeTaskStatus(t.status) === "pending" && String(t.source ?? "").toLowerCase() === "manual"
        );
        setReviewTasks(filtered);
        setProfilesMap((prev) => {
          const next = new Map(prev);
          for (const t of filtered) {
            const ap = t.assignee_profile;
            if (ap && ap.id) next.set(String(ap.id), ap);
          }
          return next;
        });
      }
    } catch (e) {
      console.error("[loadAdminDashboardSlices]", e);
      setMemberSummaryError("Kon ledenoverzicht niet laden.");
      setReviewTasksError("Kon te beoordelen taken niet laden.");
      setMemberRows([]);
      setReviewTasks([]);
    } finally {
      setMemberSummaryLoading(false);
      setReviewLoading(false);
    }
  }, []);

  const refreshAdminSlices = useCallback(async () => {
    await loadAdminDashboardSlices();
  }, [loadAdminDashboardSlices]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadAdminDashboardSlices();
  }, [isAdmin, loadAdminDashboardSlices]);

  async function downloadMemberExport() {
    try {
      const token = await getAccessTokenForAdminRoutes();
      if (!token) {
        setPlanningMsg("Log in om te exporteren.");
        return;
      }
      const res = await fetch("/api/admin/export", {
        ...ADMIN_API_FETCH_BASE,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("application/json")) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Export mislukt.");
      }
      const blob = await res.blob();
      let filename = `clubinzet-leden-${new Date().toISOString().slice(0, 10)}.csv`;
      const cd = res.headers.get("content-disposition");
      if (cd) {
        const m = /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"/i.exec(cd);
        const raw = m?.[1] ?? m?.[2];
        if (raw) {
          try {
            filename = decodeURIComponent(raw.replace(/"/g, "").trim());
          } catch {
            filename = raw.replace(/"/g, "").trim() || filename;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2500);
    } catch (e: unknown) {
      setPlanningMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const geplandVoorMij = useMemo(() => {
    const uid = String(me.id);
    return tasks
      .filter((t) => {
        if (String(t.assigned_to ?? "") !== uid) return false;
        if (normalizeTaskStatus(t.status) !== "claimed") return false;
        return String(t.source ?? "planned") !== "manual";
      })
      .slice()
      .sort((a, b) => formatTaskDate(a).localeCompare(formatTaskDate(b)));
  }, [tasks, me.id]);

  const mijnBijdragen = useMemo(() => {
    const uid = String(me.id);
    return tasks
      .filter((t) => String(t.assigned_to ?? "") === uid && String(t.source ?? "") === "manual")
      .slice()
      .sort((a, b) => formatTaskDate(b).localeCompare(formatTaskDate(a)));
  }, [tasks, me.id]);

  const myVolunteerPoints = useMemo(() => {
    const uid = String(me.id);
    let sum = 0;
    for (const t of tasks) {
      if (String(t.assigned_to ?? "") !== uid) continue;
      if (!taskContributesToVolunteerPoints(t.status)) continue;
      sum += effectiveTaskPoints(t as { points?: unknown; override_points?: unknown | null });
    }
    return Math.round(sum * 1000) / 1000;
  }, [tasks, me.id]);

  async function callTaskApi(path: string, taskId: string) {
    setTaskActionBusy(taskId);
    setPlanningMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (!token) {
        setPlanningMsg("Log in om acties op taken uit te voeren.");
        return;
      }
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ taskId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      await reload();
    } catch (e: unknown) {
      setPlanningMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTaskActionBusy(null);
    }
  }

  async function callManualReviewApi(path: "/api/tasks/approve" | "/api/tasks/reject", taskId: string) {
    setManualReviewBusy(taskId);
    setPlanningMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (!token) {
        setPlanningMsg("Log in als admin om te beoordelen.");
        return;
      }
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ taskId }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      await reload();
      router.refresh();
      if (isAdmin) await refreshAdminSlices();
    } catch (e: unknown) {
      setPlanningMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setManualReviewBusy(null);
    }
  }

  async function saveManualTaskPoints(taskId: string) {
    setPointsSaveBusy(taskId);
    setPlanningMsg(null);
    try {
      const t =
        reviewTasks.find((x) => x.id === taskId) ?? tasks.find((x) => x.id === taskId);
      const draft = pointDrafts[taskId];
      const base = t ? Math.round(effectiveTaskPoints(t)) : 0;
      const raw = (draft !== undefined ? draft : String(base)).trim();
      if (raw === "") {
        throw new Error("Vul een getal in voor de punten.");
      }
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n)) {
        throw new Error("Ongeldig getal.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (!token) {
        setPlanningMsg("Log in als admin om punten aan te passen.");
        return;
      }
      const res = await fetch("/api/tasks/update-points", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ task_id: taskId, override_points: Math.round(n) }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      setPointDrafts((d) => {
        const next = { ...d };
        delete next[taskId];
        return next;
      });
      await reload();
      if (isAdmin) await refreshAdminSlices();
    } catch (e: unknown) {
      setPlanningMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPointsSaveBusy(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function saveAvailabilityRow() {
    setAvailBusy(true);
    setAvailMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (!token) {
        setAvailMsg("Log in om beschikbaarheid op te slaan.");
        return;
      }
      const res = await fetch("/api/user/availability", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ date: availDate, available: !availNotThere }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      setAvailMsg("Opgeslagen.");
    } catch (e: unknown) {
      setAvailMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAvailBusy(false);
    }
  }

  return (
    <div style={shell}>
      <div className="mx-auto w-full max-w-6xl md:max-w-7xl">
        <header style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 8px" }}>
            <img src="/logo.svg" alt="" width={36} height={36} style={{ flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 28px)", fontWeight: 800 }}>
              {isAdmin ? "Admin" : "Mijn clubtaken"}
            </h1>
          </div>
          <p style={{ margin: 0, opacity: 0.75, fontSize: 14 }}>
            {isAdmin
              ? "Overzicht en beheer — vrijwilligers kiezen zelf taken en loggen hun bijdrage."
              : "Jouw clubtaken (in afwachting)"}
          </p>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <a href="/" style={{ color: "#60a5fa", fontSize: 14 }}>
              ← Terug naar ClubInzet
            </a>
            <button
              type="button"
              onClick={() => void handleLogout()}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#94a3b8",
                fontSize: 13,
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Uitloggen
            </button>
          </div>
        </header>

        {loading ? (
          <p style={{ opacity: 0.85 }}>Laden…</p>
        ) : !isAdmin ? (
          <>
            {myVolunteerPoints >= VOLUNTEER_QUOTA_POINTS ? (
              <div
                style={{
                  ...card,
                  marginBottom: 16,
                  borderColor: "rgba(52,199,89,0.35)",
                  background: "rgba(52,199,89,0.1)",
                }}
              >
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Vrijwilligersplicht voldaan</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.88 }}>
                  Je hebt minstens {VOLUNTEER_QUOTA_POINTS} goedgekeurde punten — je krijgt minder voorrang bij nieuwe
                  toewijzingen.
                </p>
              </div>
            ) : null}

            <section style={{ ...card, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>In afwachting</h2>
              <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.75 }}>
                Clubtaken in afwachting (niet zelf ingevoerd).
              </p>
              {geplandVoorMij.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>Geen taken in afwachting.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-[13px] text-slate-200">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left font-semibold">Titel</th>
                        <th className="px-4 py-3 text-center font-semibold">Datum</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Uitleg</th>
                        <th className="px-4 py-3 text-left font-semibold">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geplandVoorMij.map((t) => {
                        const st = normalizeTaskStatus(t.status);
                        const showAct = st === "claimed";
                        return (
                          <tr key={t.id} className="border-b border-white/[0.06]">
                            <td className="px-4 py-3 text-left align-top font-semibold break-words">
                              {t.title || t.task_type || "—"}
                            </td>
                            <td className="px-4 py-3 text-center align-top opacity-90">{formatTaskDate(t)}</td>
                            <td className="px-4 py-3 text-left align-top opacity-90">{getStatusLabel(t.status)}</td>
                            <td className="max-w-[200px] px-4 py-3 text-left align-top break-words opacity-85 leading-snug">
                              {shortExplain(t.planning_explanation)}
                            </td>
                            <td className="px-4 py-3 align-top whitespace-nowrap">
                              {showAct ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <button
                                    type="button"
                                    disabled={taskActionBusy === t.id}
                                    onClick={() => callTaskApi("/api/tasks/complete", t.id)}
                                    style={{
                                      ...btnPrimary,
                                      padding: "6px 10px",
                                      fontSize: 12,
                                      width: "auto",
                                    }}
                                  >
                                    {taskActionBusy === t.id ? "…" : "✓ Ik heb dit gedaan"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={taskActionBusy === t.id}
                                    onClick={() => callTaskApi("/api/tasks/unavailable", t.id)}
                                    style={{
                                      ...btnGhost,
                                      padding: "6px 10px",
                                      fontSize: 12,
                                      width: "auto",
                                    }}
                                  >
                                    ✗ Ik kan niet
                                  </button>
                                </div>
                              ) : (
                                <span className="opacity-50">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section style={{ ...card, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Mijn bijdragen</h2>
              <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.75 }}>
                Zelf gemelde uren — tellen pas na goedkeuring door admin.
              </p>
              {mijnBijdragen.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>Nog geen handmatige bijdragen.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-[13px] text-slate-200">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left font-semibold">Type</th>
                        <th className="px-4 py-3 text-center font-semibold">Datum</th>
                        <th className="px-4 py-3 text-left font-semibold">Punten</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Toelichting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mijnBijdragen.map((t) => (
                        <tr key={t.id} className="border-b border-white/[0.06]">
                          <td className="px-4 py-3 text-left align-top font-semibold">{t.task_type || "—"}</td>
                          <td className="px-4 py-3 text-center align-top opacity-90">{formatTaskDate(t)}</td>
                          <td className="px-4 py-3 text-left align-top opacity-90">
                            <div>{String(effectiveTaskPoints(t))}</div>
                            {t.override_points != null ? (
                              <div className="mt-1 text-[11px] opacity-80">Aangepast door admin</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-left align-top opacity-90">
                            <div>{getStatusLabel(t.status)}</div>
                            {manualFlowHint(t) ? (
                              <div className="mt-1 text-[11px] opacity-75">{manualFlowHint(t)}</div>
                            ) : null}
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-left align-top break-words opacity-85 leading-snug">
                            {shortExplain(t.description)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {planningMsg && !isAdmin ? (
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "#fca5a5" }}>{planningMsg}</p>
              ) : null}
            </section>

            <section style={{ ...card, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Niet beschikbaar op datum</h2>
              <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
                Kies een datum en markeer of je dan niet beschikbaar bent (beschikbaarheid voor de club).
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ opacity: 0.7 }}>Datum</span>
                  <input
                    type="date"
                    value={availDate}
                    onChange={(e) => setAvailDate(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "#0f172a",
                      color: "#e2e8f0",
                    }}
                  />
                </label>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={availNotThere}
                    onChange={(e) => setAvailNotThere(e.target.checked)}
                  />
                  Deze dag niet beschikbaar
                </label>
                <button
                  type="button"
                  style={{ ...btnPrimary, width: "auto", padding: "10px 16px" }}
                  disabled={availBusy}
                  onClick={() => void saveAvailabilityRow()}
                >
                  {availBusy ? "Opslaan…" : "Opslaan"}
                </button>
              </div>
              {availMsg ? (
                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94a3b8" }}>{availMsg}</p>
              ) : null}
            </section>
          </>
        ) : (
          <>
            {planningMsg ? (
              <div
                style={{
                  ...card,
                  marginBottom: 16,
                  borderColor: "rgba(165, 180, 252, 0.35)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", color: "#a5b4fc" }}>
                  {planningMsg}
                </p>
              </div>
            ) : null}
            <AdminPanel />

            <section style={{ ...card, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Statistieken</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase" }}>Taken goedgekeurd</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{approvedTasksCount}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase" }}>In afwachting</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                    {reviewLoading ? "…" : reviewTasks.length}
                  </div>
                </div>
              </div>
            </section>

            <section style={{ ...card, marginBottom: 16 }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Ledenoverzicht</h2>
                <button
                  type="button"
                  onClick={() => void downloadMemberExport()}
                  style={{ ...btnPrimary, width: "auto", padding: "8px 14px", fontSize: 13 }}
                >
                  ⬇ Download Excel
                </button>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.75 }}>
                Top 5 op punten (zelfde data als export; download bevat alle leden).
              </p>
              {memberSummaryError ? (
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#fca5a5", lineHeight: 1.45 }}>{memberSummaryError}</p>
              ) : null}
              {memberSummaryLoading ? (
                <p style={{ margin: 0, opacity: 0.85 }}>Leden laden…</p>
              ) : memberSummaryError ? null : memberRows.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Geen leden gevonden.</p>
              ) : (
                <>
                  <div className="hidden md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-0 border-collapse text-[13px] text-slate-200">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="px-3 py-2 text-left font-semibold">Naam</th>
                            <th className="px-3 py-2 text-right font-semibold">Punten</th>
                            <th className="px-3 py-2 text-right font-semibold">Aantal taken</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberRowsTop5.map((row) => (
                            <tr key={row.id} className="border-b border-white/[0.06]">
                              <td className="px-3 py-2 align-top font-medium">{row.name}</td>
                              <td className="px-3 py-2 text-right align-top tabular-nums">
                                {formatPoints1Str(row.total_points)}
                              </td>
                              <td className="px-3 py-2 text-right align-top tabular-nums">{row.total_tasks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 md:hidden">
                    {memberRowsTop5.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-[13px]"
                      >
                        <div className="font-semibold text-slate-100">{row.name}</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                          <div>
                            <span className="block text-[11px] uppercase opacity-60">Punten</span>
                            {formatPoints1Str(row.total_points)}
                          </div>
                          <div>
                            <span className="block text-[11px] uppercase opacity-60">Taken</span>
                            {row.total_tasks}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section style={{ ...card, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Te beoordelen taken</h2>
              <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.8 }}>
                Openstaande handmatige meldingen (wacht op goedkeuring). Na goedkeuring tellen punten mee.
              </p>
              {reviewTasksError ? (
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#fca5a5", lineHeight: 1.45 }}>{reviewTasksError}</p>
              ) : null}
              {reviewLoading ? (
                <p style={{ margin: 0, opacity: 0.85 }}>Taken laden…</p>
              ) : reviewTasksError ? null : reviewTasks.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
                  Geen openstaande taken om te beoordelen.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-0 border-collapse text-[13px] text-slate-200 sm:min-w-[640px]">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-2 py-2 text-left font-semibold">Gebruiker</th>
                        <th className="px-2 py-2 text-left font-semibold">Type</th>
                        <th className="px-2 py-2 text-center font-semibold">Datum</th>
                        <th className="px-2 py-2 text-left font-semibold">Punten</th>
                        <th className="px-2 py-2 text-left font-semibold">Omschrijving</th>
                        <th className="px-2 py-2 text-left font-semibold">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewTasks.map((t) => {
                        const submitterId = submitterUserIdForTask(t);
                        return (
                          <tr key={t.id} className="border-b border-white/[0.06]">
                            <td
                              className="px-2 py-2 text-left align-top"
                              title={submitterId ? truncateId(submitterId) : undefined}
                            >
                              {adminMemberDisplayName(profilesMap, submitterId, t.assignee_profile)}
                            </td>
                            <td className="px-2 py-2 text-left align-top font-semibold">{t.task_type || "—"}</td>
                            <td className="px-2 py-2 text-center align-top opacity-90">{formatTaskDate(t)}</td>
                            <td className="px-2 py-2 align-top">
                              <div style={{ fontWeight: 600 }}>{effectiveTaskPoints(t)} pt</div>
                              {t.override_points != null ? (
                                <p style={{ margin: "4px 0 0", fontSize: 11, opacity: 0.88 }}>
                                  Aangepast door admin
                                </p>
                              ) : null}
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                                <input
                                  type="number"
                                  step={1}
                                  min={0}
                                  value={pointDrafts[t.id] ?? String(Math.round(effectiveTaskPoints(t)))}
                                  onChange={(e) =>
                                    setPointDrafts((d) => ({ ...d, [t.id]: e.target.value }))
                                  }
                                  aria-label={`Punten voor taak ${truncateId(t.id)}`}
                                  title={truncateId(t.id)}
                                  style={{
                                    width: 80,
                                    padding: "6px 8px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "rgba(0,0,0,0.25)",
                                    color: "#e2e8f0",
                                    fontSize: 13,
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={pointsSaveBusy === t.id || manualReviewBusy === t.id}
                                  onClick={() => void saveManualTaskPoints(t.id)}
                                  style={{ ...btnGhost, padding: "6px 10px", fontSize: 12, width: "auto" }}
                                >
                                  {pointsSaveBusy === t.id ? "…" : "Opslaan punten"}
                                </button>
                              </div>
                            </td>
                            <td className="max-w-[200px] px-2 py-2 text-left align-top break-words leading-snug">
                              {shortExplain(t.description, 200)}
                            </td>
                            <td className="px-2 py-2 align-top whitespace-nowrap">
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <button
                                  type="button"
                                  disabled={manualReviewBusy === t.id || pointsSaveBusy === t.id}
                                  onClick={() => void callManualReviewApi("/api/tasks/approve", t.id)}
                                  style={{ ...btnPrimary, padding: "6px 10px", fontSize: 12, width: "auto" }}
                                >
                                  {manualReviewBusy === t.id ? "…" : "Goedkeuren"}
                                </button>
                                <button
                                  type="button"
                                  disabled={manualReviewBusy === t.id || pointsSaveBusy === t.id}
                                  onClick={() => void callManualReviewApi("/api/tasks/reject", t.id)}
                                  style={{ ...btnGhost, padding: "6px 10px", fontSize: 12, width: "auto" }}
                                >
                                  Afkeuren
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </>
        )}
      </div>
    </div>
  );
}

