"use client";

import Link from "next/link";

export default function VoorwaardenPage() {
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
              Gebruiksvoorwaarden ClubInzet
            </h1>
            <p className="mt-2 text-sm text-slate-300">Laatst bijgewerkt: 23 april 2026</p>
          </header>

          <div className="space-y-8 text-slate-200">
            <section>
              <h2 className="text-lg font-bold text-slate-50">1. Gebruik van de app</h2>
              <p className="mt-2 text-slate-300">
                ClubInzet is bedoeld om clubtaken te registreren en punten toe te kennen aan leden. Gebruik de
                app op een eerlijke en correcte manier.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">2. Taken en punten</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-200">
                <li>Taken moeten naar waarheid worden ingevoerd</li>
                <li>Punten worden pas toegekend na goedkeuring door een beheerder</li>
                <li>De beheerder heeft altijd het laatste woord bij twijfel of correcties</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">3. Misbruik</h2>
              <p className="mt-2 text-slate-300">Het is niet toegestaan om:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-200">
                <li>Onjuiste taken in te voeren</li>
                <li>Het systeem te manipuleren</li>
                <li>Accounts van anderen te gebruiken</li>
              </ul>
              <p className="mt-3 text-slate-300">Bij misbruik kan een account worden aangepast of verwijderd.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">4. Beschikbaarheid</h2>
              <p className="mt-2 text-slate-300">
                Wij streven naar een goed werkende app, maar geven geen garanties dat de app altijd beschikbaar
                is of foutloos werkt.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">5. Wijzigingen</h2>
              <p className="mt-2 text-slate-300">
                ClubInzet kan op elk moment worden aangepast of uitgebreid zonder voorafgaande aankondiging.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">6. Aansprakelijkheid</h2>
              <p className="mt-2 text-slate-300">
                Gebruik van de app is op eigen risico. ClubInzet is niet aansprakelijk voor eventuele schade of
                verlies van gegevens.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-50">7. Contact</h2>
              <p className="mt-2 text-slate-300">
                Voor vragen kun je contact opnemen via: <span className="font-semibold">clubinzet@doodkorte.com</span>
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

