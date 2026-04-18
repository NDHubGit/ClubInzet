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
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (cancelled) return;

      if (!user) {
        router.replace("/login");
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
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

  return <AdminDashboard me={me} />;
}
