"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AdminDashboard from "@/components/admin/AdminDashboard";
import { pathForProfileRole } from "@/lib/auth/profileRedirect";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ id: string; email?: string; role?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userErr || !user) {
        router.replace("/login");
        setAuthLoading(false);
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profErr) {
        console.error("[admin page] profiel", profErr.message, profErr.code);
      }
      const path = pathForProfileRole(profile);
      if (path !== "/admin") {
        router.replace(path);
        setAuthLoading(false);
        return;
      }

      const role = profile?.role?.trim() || "user";
      setMe({
        id: user.id,
        email: user.email ?? undefined,
        role,
      });
      setAuthLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const shell = {
    minHeight: "100vh",
    background: "#020617",
    color: "#e2e8f0",
    padding: 24,
  };

  if (authLoading || !me) {
    return (
      <div style={shell}>
        <p style={{ margin: 0, color: "#94a3b8" }}>Laden…</p>
      </div>
    );
  }

  return (
    <div style={shell}>
      <AdminDashboard me={me} />
      <a
        href="mailto:clubinzet@doodkorte.com?subject=Feedback%20ClubInzet&body=Wat%20ging%20goed%3F%0AWat%20was%20onduidelijk%3F%0AWat%20kan%20beter%3F"
        style={{
          display: "block",
          marginTop: 18,
          textAlign: "center",
          color: "rgba(148,163,184,0.9)",
          fontSize: 13,
          textDecoration: "underline",
          textUnderlineOffset: 4,
        }}
      >
        💬 Feedback geven
      </a>
    </div>
  );
}
