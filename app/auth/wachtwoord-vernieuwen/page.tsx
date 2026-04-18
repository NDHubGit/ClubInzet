"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getSupabase } from "@/lib/supabase";

/**
 * Landingspagina na klik op resetlink in e-mail (Supabase: PASSWORD_RECOVERY).
 * Zet NEXT_PUBLIC_SUPABASE_URL + redirect “Site URL” / “Redirect URLs” in Supabase op deze route.
 */
export default function WachtwoordVernieuwenPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let t1: number | undefined;
    let t2: number | undefined;
    const supabase = getSupabase();
    let authSubscription: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null;

    const markReadyIfSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) setReady(true);
    };

    const run = async () => {
      // Wacht op interne init (incl. URL-detectie bij eerste client-aanmaak op deze pagina).
      let { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionData.session) {
        setReady(true);
        return;
      }

      // PKCE: link bevat ?code= — bij een client die al eerder werd aangemaakt (prefetch / andere route)
      // draaide _initialize() zonder deze URL; exchange gebeurt dan niet automatisch.
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exErr) {
          console.error("[wachtwoord-vernieuwen] exchangeCodeForSession:", exErr);
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState(window.history.state, "", url.toString());
        ({ data: sessionData } = await supabase.auth.getSession());
        if (cancelled) return;
        if (sessionData.session) {
          setReady(true);
          return;
        }
      }

      // Implicit (fragment): access_token in hash — zelfde singleton-probleem als hierboven.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (setErr) {
          console.error("[wachtwoord-vernieuwen] setSession (hash):", setErr);
        } else {
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${window.location.search}`
          );
        }
        ({ data: sessionData } = await supabase.auth.getSession());
        if (cancelled) return;
        if (sessionData.session) {
          setReady(true);
          return;
        }
      }

      // PKCE-recovery triggert vaak SIGNED_IN i.p.v. PASSWORD_RECOVERY; beide accepteren.
      const { data: sub } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          void markReadyIfSession();
        }
      });
      authSubscription = sub;
      if (cancelled) {
        sub.subscription.unsubscribe();
        authSubscription = null;
        return;
      }

      void markReadyIfSession();
      t1 = window.setTimeout(() => void markReadyIfSession(), 800);
      t2 = window.setTimeout(() => {
        void supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
          if (!cancelled && !data.session) setLinkInvalid(true);
        });
      }, 8000);
    };

    void run();

    return () => {
      cancelled = true;
      if (t1 != null) window.clearTimeout(t1);
      if (t2 != null) window.clearTimeout(t2);
      authSubscription?.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Gebruik minstens 8 tekens.");
      return;
    }
    if (password !== password2) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      await supabase.auth.signOut();
      router.replace("/login?reset=ok");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (linkInvalid && !ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#020617] p-4 text-slate-300">
        <p className="text-center">Deze link is ongeldig of verlopen. Vraag opnieuw een resetlink aan bij inloggen.</p>
        <Link href="/login" className="text-blue-400 hover:underline">
          Naar inloggen
        </Link>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] p-4 text-slate-300">
        <p>Link laden…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Nieuw wachtwoord</h1>
        <p className="mb-6 text-sm text-gray-400">Kies een nieuw wachtwoord voor je account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-xl border border-gray-700 bg-[#020617] p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/80"
            placeholder="Nieuw wachtwoord (min. 8 tekens)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-xl border border-gray-700 bg-[#020617] p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/80"
            placeholder="Herhaal wachtwoord"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />

          {error ? (
            <div
              className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-50/90"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-500 py-3 font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? "Bezig…" : "Wachtwoord opslaan"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="text-blue-400 hover:underline">
            Terug naar inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
