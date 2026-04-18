"use client";

import type { AuthChangeEvent, RealtimeChannel, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatPoints1Str } from "@/lib/formatPoints";
import { effectiveTaskPoints, getUserVolunteerPoints, VOLUNTEER_QUOTA_POINTS } from "@/lib/points/volunteerPoints";
import { getTaskCardSurfaceStyle } from "@/lib/tasks/statusConfig";
import { getSupabase } from "@/lib/supabase";
import { TaskStatusBadge } from "@/components/tasks/TaskStatusBadge";

type MyTaskRow = {
  id: string;
  title: string | null;
  task_type: string | null;
  task_date: string | null;
  planning_explanation: string | null;
  status: string | null;
  source?: string | null;
  description?: string | null;
  points?: number | null;
  override_points?: number | null;
  team_id?: string | null;
};

function formatNlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function contributionLabel(
  taskType: string | null | undefined,
  options: { value: string; label: string }[]
): string {
  const v = String(taskType ?? "").trim().toLowerCase();
  const hit = options.find((o) => o.value === v);
  if (hit) return hit.label;
  const t = String(taskType ?? "").trim();
  return t || "—";
}

export default function MijnTakenPage() {
  const router = useRouter();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [manualTasks, setManualTasks] = useState<MyTaskRow[]>([]);
  const [volunteerPoints, setVolunteerPoints] = useState(0);
  const [manualTaskType, setManualTaskType] = useState<string>("");
  const [taskTypeOptions, setTaskTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [taskTypesReady, setTaskTypesReady] = useState(false);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualDesc, setManualDesc] = useState("");
  const [manualSubmitBusy, setManualSubmitBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    function applySessionUser(session: Session | null) {
      const u = session?.user;
      if (u) {
        setUser(u);
        return;
      }
      setUser(null);
    }
    void (async () => {
      const { data } = await sb.auth.getSession();
      applySessionUser(data.session);
      setAuthReady(true);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      applySessionUser(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { data: sessionData } = await sb.auth.getSession();
    const sessionUid = sessionData.session?.user?.id ?? null;

    if (!sessionUid) {
      setManualTasks([]);
      setVolunteerPoints(0);
      setLoading(false);
      return;
    }

    const uid = sessionUid;
    setLoading(true);
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    await sb
      .from("tasks")
      .update({ status: "missed" })
      .eq("assigned_to", uid)
      .eq("status", "claimed")
      .lt("task_date", today);

    const mine = await sb
      .from("tasks")
      .select(
        "id, title, task_type, task_date, planning_explanation, status, source, description, points, override_points, team_id"
      )
      .eq("assigned_to", uid)
      .in("status", ["claimed", "completed", "missed", "approved", "pending", "rejected"])
      .order("task_date", { ascending: false });

    if (mine.error) setError(mine.error.message);

    const mineRows = (mine.data ?? []) as MyTaskRow[];
    setManualTasks(mineRows.filter((r) => String(r.source ?? "") === "manual"));

    const vp = await getUserVolunteerPoints(sb, uid);
    setVolunteerPoints(vp);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load();
  }, [authReady, user, load]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let ch: RealtimeChannel | null = null;
    void (async () => {
      const { data: s } = await getSupabase().auth.getSession();
      if (!s.session?.user || cancelled) return;
      const sb = getSupabase();
      ch = sb
        .channel("task-flow-refresh")
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
          void load();
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (ch) void getSupabase().removeChannel(ch);
    };
  }, [user, load]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible" && user) void load();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [user, load]);

  const selectOptions = useMemo(() => {
    const o = [...taskTypeOptions];
    const hasAndersInDb = o.some((x) => x.value === "anders");
    if (!hasAndersInDb) {
      o.push({ value: "anders", label: "Anders" });
    }
    if (hasAndersInDb) {
      return [...o].sort((a, b) => a.label.localeCompare(b.label, "nl", { sensitivity: "base" }));
    }
    const rest = o.filter((x) => x.value !== "anders");
    rest.sort((a, b) => a.label.localeCompare(b.label, "nl", { sensitivity: "base" }));
    return [...rest, { value: "anders", label: "Anders" }];
  }, [taskTypeOptions]);

  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const sb = getSupabase();
        const { data: s } = await sb.auth.getSession();
        const token = s.session?.access_token;
        if (!token) {
          if (!cancelled) setTaskTypesReady(true);
          return;
        }
        const res = await fetch("/api/user/task-types", {
          credentials: "same-origin",
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await res.json().catch(() => ({}))) as {
          options?: { value: string; label: string }[];
        };
        if (cancelled) return;
        setTaskTypeOptions(Array.isArray(j.options) ? j.options : []);
      } catch {
        if (!cancelled) setTaskTypeOptions([]);
      } finally {
        if (!cancelled) setTaskTypesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!taskTypesReady || selectOptions.length === 0) return;
    setManualTaskType((prev) =>
      prev && selectOptions.some((o) => o.value === prev) ? prev : selectOptions[0].value
    );
  }, [selectOptions, taskTypesReady]);

  async function apiPost(path: string, body: Record<string, unknown>) {
    const sb = getSupabase();
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!token) throw new Error("Niet ingelogd");
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(j.error || res.statusText);
    return j;
  }

  async function handleManualContributionSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setManualSubmitBusy(true);
    setError(null);
    try {
      await apiPost("/api/tasks/manual", {
        task_type: manualTaskType,
        date: manualDate,
        description: manualDesc.trim() ? manualDesc.trim() : undefined,
      });
      setManualDesc("");
      setManualDate(new Date().toISOString().slice(0, 10));
      showToast("Bedankt! Je bijdrage wordt beoordeeld door de club.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setManualSubmitBusy(false);
    }
  }

  useEffect(() => {
    if (authReady && !user) {
      router.replace("/login");
    }
  }, [authReady, user, router]);

  if (!authReady || !user) {
    return (
      <div style={{ minHeight: "100dvh", padding: 24, color: "var(--muted)" }}>
        {!authReady ? "Laden…" : "Doorverwijzen naar login…"}
      </div>
    );
  }

  const btnBase: CSSProperties = {
    width: "100%",
    minHeight: 54,
    borderRadius: 16,
    border: "none",
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 12,
  };

  const btnPrimary = { ...btnBase, background: "#2563eb", color: "#fff" };

  const sectionTitle: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "var(--muted)",
    margin: "0 0 14px",
  };

  const cardStyle: CSSProperties = {
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
  };

  return (
    <div className="wrap" style={{ paddingBottom: "calc(88px + var(--safe-bottom))" }}>
      <header style={{ marginBottom: 24 }}>
        <Link href="/" style={{ fontSize: 14, color: "var(--muted)" }}>
          ← Home
        </Link>
        <h1 style={{ margin: "14px 0 6px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Log een taak</h1>
        {!loading ? (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 16, lineHeight: 1.5 }}>
              <span style={{ color: "var(--muted)" }}>Punten: </span>
              <strong style={{ color: "var(--text)" }}>{formatPoints1Str(volunteerPoints)}</strong>
              <span style={{ color: "var(--muted)" }}> / {VOLUNTEER_QUOTA_POINTS}</span>
            </p>
            {volunteerPoints >= VOLUNTEER_QUOTA_POINTS ? (
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 700,
                  background: "rgba(52,199,89,0.15)",
                  color: "#bbf7d0",
                  border: "1px solid rgba(52,199,89,0.35)",
                }}
              >
                🎉 Vrijwilligersplicht voldaan
              </div>
            ) : null}
          </>
        ) : null}
      </header>

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "calc(20px + var(--safe-bottom))",
            left: 16,
            right: 16,
            maxWidth: 28 * 16,
            margin: "0 auto",
            zIndex: 60,
            padding: "14px 18px",
            borderRadius: 14,
            background: "rgba(15,23,42,0.96)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#f8fafc",
            fontSize: 15,
            fontWeight: 600,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          }}
        >
          {toast}
        </div>
      ) : null}

      {error ? (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderColor: "rgba(239,68,68,0.35)",
            background: "rgba(127,29,29,0.25)",
            color: "#fecaca",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "var(--muted)", marginTop: 24, fontSize: 15 }}>Taken laden…</p>
      ) : (
        <>
          {/* Mijn bijdragen — invoer + lijst */}
          <section>
            <h2 style={sectionTitle}>MIJN BIJDRAGEN</h2>

            <div className="card" style={{ ...cardStyle, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800 }}>Ik heb geholpen</h3>
              <form onSubmit={(e) => void handleManualContributionSubmit(e)}>
                <label style={{ display: "block", marginBottom: 14, fontSize: 14 }}>
                  <span style={{ display: "block", opacity: 0.75, marginBottom: 6 }}>Soort</span>
                  <select
                    value={manualTaskType}
                    onChange={(e) => setManualTaskType(e.target.value)}
                    required
                    disabled={!taskTypesReady}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: 16,
                      opacity: taskTypesReady ? 1 : 0.7,
                    }}
                  >
                    {!taskTypesReady ? (
                      <option value="">Soort laden…</option>
                    ) : (
                      selectOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label style={{ display: "block", marginBottom: 14, fontSize: 14 }}>
                  <span style={{ display: "block", opacity: 0.75, marginBottom: 6 }}>Datum</span>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: 16,
                    }}
                  />
                </label>
                <label style={{ display: "block", marginBottom: 18, fontSize: 14 }}>
                  <span style={{ display: "block", opacity: 0.75, marginBottom: 6 }}>Beschrijving (optioneel)</span>
                  <textarea
                    value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)}
                    rows={3}
                    placeholder="Kort wat je hebt gedaan…"
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: 15,
                      resize: "vertical",
                      minHeight: 88,
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={manualSubmitBusy || !taskTypesReady}
                  style={{
                    ...btnPrimary,
                    minHeight: 52,
                    marginTop: 0,
                    opacity: manualSubmitBusy || !taskTypesReady ? 0.75 : 1,
                  }}
                >
                  {manualSubmitBusy ? "Bezig…" : "Opslaan bijdrage"}
                </button>
              </form>
            </div>

            {manualTasks.length === 0 ? (
              <div className="card" style={{ ...cardStyle, opacity: 0.88 }}>
                <p style={{ margin: 0, fontSize: 15 }}>Nog geen eigen meldingen.</p>
              </div>
            ) : (
              manualTasks.map((t) => (
                <div
                  key={t.id}
                  className="card"
                  style={{ ...cardStyle, marginBottom: 12, ...getTaskCardSurfaceStyle(t.status) }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700, flex: 1 }}>
                      {contributionLabel(t.task_type, selectOptions)}
                    </p>
                    <TaskStatusBadge status={t.status} />
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 15, color: "var(--muted)" }}>{formatNlDate(t.task_date)}</p>
                  {t.description && String(t.description).trim() ? (
                    <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.45, opacity: 0.92 }}>
                      {String(t.description).trim()}
                    </p>
                  ) : null}
                  <p style={{ margin: "10px 0 0", fontSize: 14, opacity: 0.9 }}>
                    <span style={{ color: "var(--muted)" }}>Punten </span>
                    <span style={{ fontWeight: 600 }}>{effectiveTaskPoints(t)}</span>
                    {t.override_points != null ? (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#a5b4fc",
                          opacity: 0.95,
                        }}
                      >
                        Aangepast door admin
                      </span>
                    ) : null}
                  </p>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
