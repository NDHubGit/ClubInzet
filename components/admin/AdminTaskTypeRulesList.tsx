"use client";

import type { PointRuleRow } from "@/lib/admin/pointsAdminTypes";

import { adminBtnGhost, adminBtnPrimary } from "./adminSharedStyles";

export type AdminTaskTypeRulesListProps = {
  rules: PointRuleRow[];
  loading: boolean;
  busyId: string | null;
  onCreate: () => void;
  onEdit: (r: PointRuleRow) => void;
  onDelete: (id: string) => void;
  onToggleActive: (r: PointRuleRow) => void;
};

function shortDesc(text: string | null | undefined, max = 80): string {
  const s = text?.trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function AdminTaskTypeRulesList({
  rules,
  loading,
  busyId,
  onCreate,
  onEdit,
  onDelete,
  onToggleActive,
}: AdminTaskTypeRulesListProps) {
  if (loading) {
    return <p style={{ margin: 0, opacity: 0.85 }}>Taaktypes laden…</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onCreate} style={{ ...adminBtnPrimary, width: "auto", padding: "8px 14px", fontSize: 13 }}>
          + Nieuw taaktype
        </button>
      </div>

      {rules.length === 0 ? (
        <p style={{ margin: 0, opacity: 0.88, fontSize: 14 }}>Nog geen taaktypes ingesteld. Voeg er één toe.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[13px] text-slate-200">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-2 py-2 text-left font-semibold">Taaktype / naam</th>
                    <th className="px-2 py-2 text-right font-semibold">Duur (min)</th>
                    <th className="px-2 py-2 text-right font-semibold">Punten</th>
                    <th className="px-2 py-2 text-center font-semibold">Actief</th>
                    <th className="px-2 py-2 text-left font-semibold">Omschrijving</th>
                    <th className="px-2 py-2 text-left font-semibold">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => {
                    const busy = busyId === r.id;
                    const btnP = { ...adminBtnPrimary, padding: "6px 10px", fontSize: 12, width: "auto" as const };
                    const btnG = { ...adminBtnGhost, padding: "6px 10px", fontSize: 12, width: "auto" as const };
                    return (
                      <tr key={r.id} className="border-b border-white/[0.06]">
                        <td className="max-w-[220px] px-2 py-2 align-top break-words">
                          <div className="font-semibold text-slate-100">{r.label?.trim() || r.task_type || "—"}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-sky-200/90">{r.task_type}</div>
                        </td>
                        <td className="px-2 py-2 text-right align-top tabular-nums">{r.default_minutes ?? "—"}</td>
                        <td className="px-2 py-2 text-right align-top tabular-nums">{r.basis_points ?? "—"}</td>
                        <td className="px-2 py-2 text-center align-top">
                          <span className={r.active === false ? "text-rose-300" : "text-emerald-300"}>
                            {r.active === false ? "Nee" : "Ja"}
                          </span>
                        </td>
                        <td className="max-w-[200px] px-2 py-2 align-top text-[12px] leading-snug opacity-85">
                          {shortDesc(r.description)}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" disabled={busy} style={btnP} onClick={() => onEdit(r)}>
                              Bewerken
                            </button>
                            <button type="button" disabled={busy} style={btnG} onClick={() => onToggleActive(r)}>
                              {r.active === false ? "Activeren" : "Deactiveren"}
                            </button>
                            <button type="button" disabled={busy} style={btnG} onClick={() => onDelete(r.id)}>
                              Verwijderen
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {rules.map((r) => {
              const busy = busyId === r.id;
              const btnP = { ...adminBtnPrimary, padding: "6px 10px", fontSize: 12, width: "auto" as const };
              const btnG = { ...adminBtnGhost, padding: "6px 10px", fontSize: 12, width: "auto" as const };
              return (
                <div key={r.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-[13px]">
                  <div className="font-semibold text-slate-100">{r.label?.trim() || r.task_type || "—"}</div>
                  <div className="mt-0.5 font-mono text-[12px] text-sky-200">{r.task_type}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="block text-[11px] uppercase opacity-60">Duur (min)</span>
                      {r.default_minutes ?? "—"}
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase opacity-60">Punten</span>
                      {r.basis_points ?? "—"}
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[11px] uppercase opacity-60">Actief</span>
                      <span className={r.active === false ? "text-rose-300" : "text-emerald-300"}>
                        {r.active === false ? "Nee" : "Ja"}
                      </span>
                    </div>
                  </div>
                  {r.description?.trim() ? (
                    <p className="mt-2 text-[12px] leading-snug opacity-80">{shortDesc(r.description, 200)}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} style={btnP} onClick={() => onEdit(r)}>
                      Bewerken
                    </button>
                    <button type="button" disabled={busy} style={btnG} onClick={() => onToggleActive(r)}>
                      {r.active === false ? "Activeren" : "Deactiveren"}
                    </button>
                    <button type="button" disabled={busy} style={btnG} onClick={() => onDelete(r.id)}>
                      Verwijderen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
