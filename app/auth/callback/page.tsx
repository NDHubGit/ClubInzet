"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchOrCreateClientProfile } from "@/lib/auth/clientProfile";
import { pathForProfileRole } from "@/lib/auth/profileRedirect";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("Auth callback:", error);
          setErr(error.message);
          return;
        }
      }

      const result = await fetchOrCreateClientProfile(supabase, "[CALLBACK USER]");

      if (!result.ok) {
        if (result.code === "no_user") {
          router.replace("/login");
          return;
        }
        setErr(
          result.code === "select_error"
            ? "Profiel kon niet worden geladen."
            : "Profiel kon niet worden aangemaakt. Controleer RLS (select/insert eigen profiel)."
        );
        return;
      }

      router.replace(pathForProfileRole(result.profile));
      router.refresh();
    };

    void run();
  }, [router]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] p-6 text-amber-100">
        <p>{err}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-6 text-slate-300">
      <p>Inloggen…</p>
    </div>
  );
}
