"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#020617] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[700px]">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-blue-500/70"
          >
            ← Terug
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 shadow-xl sm:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">
              Privacyverklaring ClubInzet
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Laatst bijgewerkt: 23 april 2026
            </p>
          </header>

          <div className="space-y-8 text-slate-200">
            <section>
              <h2 className="text-lg font-bold text-slate-50">1. Welke gegevens verzamelen we</h2>
              <p className="mt-2 text-slate-300">Wij verwerken de volgende gegevens:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-200">
                <li>E-mailadres</li>
                <li>Gebruikersnaam (display name)</li>
                <li>Activiteiten binnen de app (taken en punten)</li>
                <li>Technische gegevens (zoals inlogmomenten)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">2. Waarom verzamelen we deze gegevens</h2>
              <p className="mt-2 text-slate-300">Deze gegevens worden gebruikt om:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-200">
                <li>Accounts aan te maken en beheren</li>
                <li>Taken te registreren en beoordelen</li>
                <li>Ranglijsten en scores te tonen</li>
                <li>De werking van de app te verbeteren</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">3. Delen van gegevens</h2>
              <p className="mt-2 text-slate-300">
                Wij delen geen persoonsgegevens met derden, tenzij dit technisch noodzakelijk is (bijvoorbeeld
                hosting via Vercel en database via Supabase).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">4. Bewaartermijn</h2>
              <p className="mt-2 text-slate-300">
                Gegevens worden bewaard zolang het account actief is of zolang dit nodig is voor het functioneren
                van de app.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">5. Jouw rechten</h2>
              <p className="mt-2 text-slate-300">Je hebt recht op:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-200">
                <li>Inzage van je gegevens</li>
                <li>Correctie of verwijdering</li>
                <li>Verzoek tot verwijdering van je account</li>
              </ul>
              <p className="mt-3 text-slate-300">
                Voor vragen kun je contact opnemen via:{" "}
                <a
                  href="mailto:clubinzet@doodkorte.com?subject=Vraag%20omtrent%20Privacy%20ClubInzet"
                  className="underline underline-offset-4 hover:opacity-80"
                >
                  clubinzet@doodkorte.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">6. Beveiliging</h2>
              <p className="mt-2 text-slate-300">
                Wij nemen passende maatregelen om jouw gegevens te beschermen tegen misbruik en ongeautoriseerde
                toegang.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">7. Cookies</h2>
              <p className="mt-2 text-slate-300">
                ClubInzet gebruikt alleen functionele cookies voor het inloggen en functioneren van de app.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

