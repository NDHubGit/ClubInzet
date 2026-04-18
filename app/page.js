"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchOrCreateClientProfile } from "@/lib/auth/clientProfile";
import { getDisplayName, resolveProfilePublicName } from "@/lib/displayName";
import { normalizeTaskStatus } from "@/lib/planning/taskStatus";
import { getSupabase } from "@/lib/supabase";
import { formatDuurPuntRegel, formatPoints1Str, puntwoordVoorDisplay } from "@/lib/formatPoints";
import { calculatePoints } from "@/lib/points/calculatePoints";
import { effectiveTaskPoints } from "@/lib/points/effectiveTaskPoints";
import { VOLUNTEER_QUOTA_POINTS } from "@/lib/points/volunteerPoints";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";
import { getTaskCardSurfaceStyle } from "@/lib/tasks/statusConfig";
import AppBrandTitle from "@/components/branding/AppBrandTitle";
import { buildLeaderboardFromTasks } from "@/lib/leaderboard/buildLeaderboardFromTasks";

const medals = ["🥇", "🥈", "🥉"];

function taskPointsDisplay(t) {
  const o = t.override_points;
  if (o != null && o !== "" && Number.isFinite(Number(o))) return Number(o);
  const p = Number(t.points);
  if (Number.isFinite(p)) return p;
  const m = Number(t.duration_minutes);
  return Number.isFinite(m) ? m / 60 : 0;
}

/** Punten per taak: duration_minutes / 60 */
function pointsFromDurationMinutes(task) {
  const m = Number(task.duration_minutes);
  return Number.isFinite(m) ? m / 60 : 0;
}

function dashboardTaskSortDate(t) {
  if (t.task_date) return String(t.task_date).slice(0, 10);
  if (t.created_at) return String(t.created_at).slice(0, 10);
  return "0000-00-00";
}

/** Dashboard “Je taken”: alleen toegewezen werk met claimed / goedgekeurd / afgerond (geen pool-planned). */
function isDashboardPreviewTask(t) {
  const n = normalizeTaskStatus(t.status);
  return n === "claimed" || n === "approved" || n === "completed";
}

function compareDashboardTasks(a, b) {
  const pri = (s) => {
    const x = normalizeTaskStatus(s);
    if (x === "claimed") return 0;
    if (x === "approved" || x === "completed") return 1;
    return 2;
  };
  const c = pri(a.status) - pri(b.status);
  if (c !== 0) return c;
  return dashboardTaskSortDate(a).localeCompare(dashboardTaskSortDate(b));
}

export default function HomePage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  /** id, email (alleen zelf), profile (voor weergavenaam) */
  const [user, setUser] = useState(null);
  const [leaderboardProfiles, setLeaderboardProfiles] = useState(() => new Map());

  const loadData = useCallback(async () => {
    const sb = getSupabase();
    const { data: sessionWrap, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) console.error("[loadData] getSession:", sessionErr);
    const u = sessionWrap?.session?.user ?? null;

    if (!u) {
      router.replace("/login");
      return;
    }

    const ensured = await fetchOrCreateClientProfile(sb, "[HOME]");
    if (!ensured.ok) {
      router.replace("/login");
      return;
    }
    const prof = ensured.profile;
    setUser({
      id: u.id,
      email: u.email || "",
      profile: {
        id: prof.id,
        email: prof.email ?? u.email ?? null,
        display_name: prof.display_name ?? null,
        name: prof.name ?? null,
      },
    });

    const { data: allTasks, error: errTasks } = await sb
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (errTasks) {
      console.error("[loadData] tasks select:", {
        message: errTasks.message,
        code: errTasks.code,
        details: errTasks.details,
        hint: errTasks.hint,
        raw: errTasks,
      });
    }

    const list = allTasks || [];
    const mine = list.filter((t) => {
      const aid = t.assigned_to;
      if (aid != null && String(aid).trim() !== "") return String(aid) === String(u.id);
      return String(t.user_id) === String(u.id);
    });
    setTasks(mine);
    const board = buildLeaderboardFromTasks(list);
    setLeaderboard(board);

    const ids = [...new Set(board.map((r) => r.user_id).filter(Boolean))];
    if (ids.length > 0) {
      const { data: profs } = await sb
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      const nm = new Map();
      for (const p of profs || []) {
        nm.set(String(p.id), {
          id: p.id,
          display_name: p.display_name,
          email: p.email,
        });
      }
      setLeaderboardProfiles(nm);
    } else {
      setLeaderboardProfiles(new Map());
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (cancelled) return;
        await loadData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const dashboardPreviewTasks = useMemo(() => {
    const list = tasks.filter(isDashboardPreviewTask);
    list.sort(compareDashboardTasks);
    return list.slice(0, 3);
  }, [tasks]);

  const leaderboardTop5 = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);

  function effectiveMeUserId() {
    if (!user) return null;
    return user.id;
  }

  function leaderboardLabel(userId) {
    const meId = effectiveMeUserId();
    let prof = leaderboardProfiles.get(String(userId));
    if (!prof && user && String(userId) === String(user.id)) {
      prof = user.profile;
    }
    return getDisplayName(prof ?? { id: userId }, meId);
  }

  function leaderboardTaskWord(n) {
    return n === 1 ? "taak" : "taken";
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  const totalPoints = calculatePoints(tasks);
  const totalPointsSafe = Number.isFinite(Number(totalPoints)) ? Number(totalPoints) : 0;
  const taskCount = tasks.filter((t) => {
    const n = normalizeTaskStatus(t.status);
    return n === "claimed" || n === "approved" || n === "completed";
  }).length;

  const shell = {
    minHeight: "100vh",
    background: "#020617",
    padding: "24px 16px 48px",
  };

  const card = {
    maxWidth: 500,
    margin: "0 auto 24px",
    padding: 24,
    borderRadius: 16,
    background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
    color: "#f8fafc",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  const btnGhost = {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "rgba(248,250,252,0.85)",
    fontWeight: 500,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
    marginTop: 12,
  };

  return (
    <div style={shell}>
      <div style={card}>
        <AppBrandTitle iconSize={40} titleSize={32} style={{ marginBottom: 4 }} />

        {user && (
          <>
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: 0, opacity: 0.75, fontSize: 14, lineHeight: 1.45 }}>
                👤 <strong style={{ color: "#f8fafc" }}>{resolveProfilePublicName(user.profile)}</strong>
                {user.email ? (
                  <span style={{ display: "block", marginTop: 6, fontSize: 13, opacity: 0.65 }}>
                    {user.email}
                  </span>
                ) : null}
              </p>
            </div>
            <p style={{ margin: "16px 0 0" }}>
              <a
                href="/user"
                style={{
                  display: "block",
                  padding: "14px 18px",
                  borderRadius: 14,
                  background: "#2563eb",
                  border: "none",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 17,
                  textAlign: "center",
                  textDecoration: "none",
                  boxShadow: "0 10px 28px rgba(37,99,235,0.35)",
                }}
              >
                📋 Log een taak
              </a>
            </p>
          </>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "32px 0", opacity: 0.85 }}>Laden…</div>
        ) : (
          <>
            <div style={{ marginBottom: 24, marginTop: 24 }}>
              <p style={{ margin: "0 0 4px", opacity: 0.7, fontSize: 14 }}>Jouw totaal</p>
              <p style={{ margin: 0, fontSize: 36, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                {formatPoints1Str(totalPointsSafe)}{" "}
                <span style={{ fontSize: 18, fontWeight: 600, opacity: 0.75 }}>
                  {puntwoordVoorDisplay(totalPointsSafe)}
                </span>
              </p>
              <p style={{ margin: "10px 0 0", opacity: 0.72, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ opacity: 0.75 }}>Punten: </span>
                <strong style={{ fontWeight: 700 }}>{formatPoints1Str(totalPointsSafe)}</strong>
                <span style={{ opacity: 0.78 }}> / {VOLUNTEER_QUOTA_POINTS}</span>
              </p>
              <p style={{ margin: "12px 0 0", opacity: 0.7, fontSize: 15 }}>
                {taskCount} {taskCount === 1 ? "taak" : "taken"} gelogd
              </p>
            </div>

            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, opacity: 0.95 }}>Je taken</h3>

            {tasks.length === 0 ? (
              <p style={{ margin: "0 0 20px", opacity: 0.75, lineHeight: 1.5 }}>Nog geen taken gelogd.</p>
            ) : dashboardPreviewTasks.length === 0 ? (
              <p style={{ margin: "0 0 16px", opacity: 0.75, lineHeight: 1.5 }}>
                Geen actuele taken in dit overzicht. Voeg iets toe of bekijk alles onder Log een taak.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
                {dashboardPreviewTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      ...getTaskCardSurfaceStyle(t.status),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 600, flex: 1 }}>{t.task_type}</div>
                      <TaskStatusBadge status={t.status} />
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.7 }}>
                      {formatDuurPuntRegel(t.duration_minutes, taskPointsDisplay(t))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tasks.length > 0 ? (
              <p style={{ margin: "0 0 20px" }}>
                <a
                  href="/taken"
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#e2e8f0",
                    fontWeight: 600,
                    fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  Bekijk alles
                </a>
              </p>
            ) : null}
          </>
        )}
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22, fontWeight: 800 }}>🏆 Klassement</h2>
        {leaderboard.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>Nog geen scores</p>
        ) : (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.72 }}>Top 5 — volledige lijst via de knop hieronder.</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {leaderboardTop5.map((row, i) => {
                const meId = effectiveMeUserId();
                const isMe = user && meId != null && String(row.user_id) === String(meId);
                const medal = i < 3 ? medals[i] : null;
                return (
                  <li
                    key={row.user_id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: isMe ? "rgba(59,130,246,0.2)" : "rgba(0,0,0,0.18)",
                      border: isMe ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>
                      <span style={{ opacity: 0.85, marginRight: 8 }}>{i + 1}.</span>
                      {medal ? <span style={{ marginRight: 8 }}>{medal}</span> : null}
                      <strong style={{ fontWeight: 600 }}>{leaderboardLabel(row.user_id)}</strong>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 700, whiteSpace: "nowrap", display: "block" }}>
                        {formatPoints1Str(row.total_points)} {puntwoordVoorDisplay(row.total_points)}
                      </span>
                      <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 500, whiteSpace: "nowrap" }}>
                        {row.total_tasks} {leaderboardTaskWord(row.total_tasks)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p style={{ margin: "16px 0 0", textAlign: "center" }}>
              <Link
                href="/klassement"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  borderRadius: 12,
                  background: "rgba(59,130,246,0.22)",
                  border: "1px solid rgba(59,130,246,0.45)",
                  color: "#e0f2fe",
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                Volledige klassement →
              </Link>
            </p>
          </>
        )}
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "0 8px" }}>
        <button type="button" style={btnGhost} onClick={signOut}>
          Uitloggen
        </button>
        <a
          href="/admin"
          style={{ display: "block", textAlign: "center", marginTop: 14, color: "#94a3b8", fontSize: 13 }}
        >
          Clubbeheer (admin)
        </a>
      </div>
    </div>
  );
}
