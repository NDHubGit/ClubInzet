"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchOrCreateClientProfile } from "@/lib/auth/clientProfile";
import { leaderboardParticipantName } from "@/lib/displayName";
import { buildLeaderboardFromTasks } from "@/lib/leaderboard/buildLeaderboardFromTasks";
import { fetchLeaderboardProfilesForIds } from "@/lib/leaderboard/fetchLeaderboardProfiles";
import { getSupabase } from "@/lib/supabase";
import { formatPoints1Str, puntwoordVoorDisplay } from "@/lib/formatPoints";

const medals = ["🥇", "🥈", "🥉"];

export default function KlassementPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState([]);
  const [user, setUser] = useState(null);
  const [leaderboardProfiles, setLeaderboardProfiles] = useState(() => new Map());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const sb = getSupabase();
    const { data: sessionWrap, error: sessionErr } = await sb.auth.getSession();
    if (sessionErr) console.error("[klassement] getSession:", sessionErr);
    const u = sessionWrap?.session?.user ?? null;

    if (!u) {
      router.replace("/login");
      return;
    }

    const ensured = await fetchOrCreateClientProfile(sb, "[KLASSEMENT]");
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
      console.error("[klassement] tasks:", errTasks);
    }

    const list = allTasks || [];
    const board = buildLeaderboardFromTasks(list);
    setLeaderboard(board);

    const ids = [...new Set(board.map((r) => r.user_id).filter(Boolean))];
    const nm = await fetchLeaderboardProfilesForIds(sb, ids);
    setLeaderboardProfiles(nm);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!cancelled) await loadData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

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
    return leaderboardParticipantName(prof ?? { id: userId }, meId);
  }

  function leaderboardTaskWord(n) {
    return n === 1 ? "taak" : "taken";
  }

  const shell = {
    minHeight: "100vh",
    background: "#020617",
    padding: "24px 16px 48px",
  };

  const card = {
    maxWidth: "min(960px, 100%)",
    margin: "0 auto 24px",
    padding: 24,
    borderRadius: 16,
    background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
    color: "#f8fafc",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  return (
    <div style={shell}>
      <div style={card}>
        <p style={{ margin: "0 0 12px" }}>
          <Link href="/" style={{ color: "#93c5fd", fontSize: 14, fontWeight: 600 }}>
            ← Terug naar dashboard
          </Link>
        </p>
        <div style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.svg" alt="" width={40} height={40} style={{ flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>🏆 Klassement</h1>
        </div>
        <p style={{ margin: "0 0 20px", opacity: 0.75, fontSize: 14 }}>Alle deelnemers op basis van goedgekeurde en afgeronde taken.</p>

        {loading ? (
          <p style={{ textAlign: "center", opacity: 0.85 }}>Laden…</p>
        ) : leaderboard.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>Nog geen scores</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {leaderboard.map((row, i) => {
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
        )}
      </div>
    </div>
  );
}
