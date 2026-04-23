"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppBrandTitle from "@/components/branding/AppBrandTitle";
import { fetchOrCreateClientProfile } from "@/lib/auth/clientProfile";
import { pathForProfileRole } from "@/lib/auth/profileRedirect";
import { createBrowserClient } from "@/lib/supabase";

const supabase = createBrowserClient();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("reset") === "ok") {
      setResetInfo("Je wachtwoord is bijgewerkt. Je kunt nu opnieuw inloggen.");
    }
  }, []);

  async function afterAuth() {
    const result = await fetchOrCreateClientProfile(supabase, "[LOGIN USER]");

    if (!result.ok) {
      if (result.code === "no_user") {
        router.replace("/login");
        return;
      }
      if (result.code === "select_error") {
        setError(
          result.detail
            ? `Profiel kon niet worden geladen. ${result.detail}`
            : "Profiel kon niet worden geladen. Vernieuw de pagina of probeer opnieuw in te loggen."
        );
        return;
      }
      setError(
        result.detail
          ? `Profiel kon niet worden aangemaakt. ${result.detail}`
          : "Profiel kon niet worden aangemaakt. Vernieuw de pagina of probeer opnieuw — je account is wel ingelogd."
      );
      return;
    }

    router.replace(pathForProfileRole(result.profile));
    router.refresh();
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResetInfo(null);
    const em = email.trim();
    if (!em) {
      setError("Vul je e-mailadres in.");
      return;
    }

    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: `${origin}/auth/wachtwoord-vernieuwen`,
      });
      if (resetErr) throw resetErr;
      setResetInfo(
        "Als dit e-mailadres bij ons bekend is, ontvang je zo een mail met een link om je wachtwoord te vernieuwen."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResetInfo(null);
    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      setError("Vul e-mail en wachtwoord in.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signErr } = await supabase.auth.signUp({ email: em, password: pw });
        if (signErr) throw signErr;
        const signedUp = data.user;
        if (!signedUp) {
          setError("Account aangemaakt — bevestig je e-mail als dat verplicht is, en log daarna opnieuw in.");
          return;
        }
        await afterAuth();
        return;
      }

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (signInErr) throw signInErr;
      if (!data.user) {
        setError("Geen gebruiker na login.");
        return;
      }
      await afterAuth();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4">
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/10">
        <div className="mb-3">
          <AppBrandTitle titleSize={26} iconSize={36} />
        </div>
        <p className="text-gray-400 mb-6 text-sm">
          {mode === "forgot"
            ? "Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord te kiezen."
            : "Log in met je club-account."}
        </p>

        {mode === "forgot" ? (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full p-3 rounded-xl bg-[#020617] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/80"
              placeholder="E-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error ? (
              <div
                className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-50/90"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            {resetInfo ? (
              <div
                className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-50/90"
                role="status"
              >
                {resetInfo}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {loading ? "Bezig…" : "Resetlink versturen"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              autoComplete="email"
              required
              className="w-full p-3 rounded-xl bg-[#020617] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/80"
              placeholder="E-mailadres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              className="w-full p-3 rounded-xl bg-[#020617] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/80"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error ? (
              <div
                className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-50/90"
                role="alert"
              >
                {error}
              </div>
            ) : null}
            {resetInfo ? (
              <div
                className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-50/90"
                role="status"
              >
                {resetInfo}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              {loading ? "Bezig…" : mode === "signup" ? "Account aanmaken" : "Inloggen"}
            </button>
          </form>
        )}

        {mode === "login" ? (
          <p className="mt-4 text-center text-sm">
            <button
              type="button"
              className="text-blue-400 hover:underline"
              onClick={() => {
                setMode("forgot");
                setError(null);
                setResetInfo(null);
                setPassword("");
              }}
            >
              Wachtwoord vergeten?
            </button>
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === "forgot" ? (
            <>
              <button
                type="button"
                className="text-blue-400 hover:underline"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Terug naar inloggen
              </button>
            </>
          ) : mode === "login" ? (
            <>
              Nog geen account?{" "}
              <button
                type="button"
                className="text-blue-400 hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setResetInfo(null);
                }}
              >
                Registreren
              </button>
            </>
          ) : (
            <>
              Al een account?{" "}
              <button
                type="button"
                className="text-blue-400 hover:underline"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setResetInfo(null);
                }}
              >
                Inloggen
              </button>
            </>
          )}
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/privacy"
            className="text-xs font-semibold text-slate-300/80 hover:text-slate-100 underline underline-offset-4"
          >
            Privacy
          </Link>
          <Link
            href="/voorwaarden"
            className="text-xs font-semibold text-slate-300/80 hover:text-slate-100 underline underline-offset-4"
          >
            Voorwaarden
          </Link>
        </div>

        <a
          href="mailto:clubinzet@doodkorte.com?subject=Feedback%20ClubInzet&body=Wat%20ging%20goed%3F%0AWat%20was%20onduidelijk%3F%0AWat%20kan%20beter%3F"
          className="block mt-6 text-center text-xs font-semibold text-slate-300/80 underline underline-offset-4 hover:text-slate-100 hover:opacity-80"
        >
          💬 Feedback geven
        </a>
      </div>
    </div>
  );
}
