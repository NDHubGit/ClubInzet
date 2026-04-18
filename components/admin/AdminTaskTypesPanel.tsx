"use client";

import { useCallback, useEffect, useState } from "react";

import { formatTaskTypeRuleMutationError } from "@/lib/admin/formatTaskTypeRuleMutationError";
import type { PointRuleCreateBody, PointRulePatchBody, PointRuleRow } from "@/lib/admin/pointsAdminTypes";

import { ADMIN_API_FETCH_BASE, getAccessTokenForAdminRoutes } from "./adminRouteFetch";
import AdminPointsForm, { emptyPointRuleDraft, ruleToDraft, type AdminPointsFormDraft } from "./AdminPointsForm";
import AdminTaskTypeRulesList from "./AdminTaskTypeRulesList";
import { adminBtnGhost, adminBtnPrimary, adminCard } from "./adminSharedStyles";

function validateDraft(d: AdminPointsFormDraft, mode: "create" | "edit"): string | null {
  const tt = d.task_type.trim().toLowerCase();
  if (!tt) return "Taaktype is verplicht.";
  const lab = d.label.trim();
  if (!lab) return "Naam is verplicht.";
  const dm = Number(d.default_minutes);
  if (!Number.isFinite(dm) || dm <= 0) return "Standaard minuten moet een getal groter dan 0 zijn.";
  const bp = Number(String(d.basis_points).replace(",", "."));
  if (!Number.isFinite(bp) || bp < 0) return "Punten moeten een getal ≥ 0 zijn.";
  return null;
}

type TaskTypesApiJson = { rules?: PointRuleRow[]; error?: string; message?: string };

function devWarn(scope: string, err: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[AdminTaskTypesPanel] ${scope}`, err);
  }
}

/** Alleen voor dit blok; geen koppeling met de globale `planningMsg` op het dashboard. */
function userFacingTaskTypesMessage(res: Response, j: TaskTypesApiJson): string {
  const code = j.error;
  if (res.status === 503 || code === "ADMIN_SERVER_CONFIG") {
    return "Admin serverconfiguratie ontbreekt.";
  }
  if (res.status === 403 || code === "ADMIN_AUTH_FORBIDDEN") {
    return "Geen adminrechten op de server voor dit onderdeel. Vernieuw de pagina (F5) of log opnieuw in.";
  }
  if (
    res.status >= 500 ||
    code === "SUPABASE_QUERY_ERROR" ||
    code === "UNEXPECTED" ||
    code === "ADMIN_AUTH_CHECK_FAILED"
  ) {
    return "Kon taaktypes niet laden.";
  }
  const raw = (j.message?.trim() || j.error?.trim() || res.statusText || "").trim();
  if (!raw || raw === "Internal Server Error") {
    return "Kon taaktypes niet laden.";
  }
  return formatTaskTypeRuleMutationError(raw);
}

export default function AdminTaskTypesPanel() {
  const [rules, setRules] = useState<PointRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRule, setEditingRule] = useState<PointRuleRow | null>(null);
  const [draft, setDraft] = useState<AdminPointsFormDraft>(emptyPointRuleDraft);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [panelNotice, setPanelNotice] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setPanelNotice(null);
    try {
      const token = await getAccessTokenForAdminRoutes();
      if (!token) {
        setRules([]);
        return;
      }
      const res = await fetch("/api/admin/task-type-rules", {
        ...ADMIN_API_FETCH_BASE,
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as TaskTypesApiJson;
      if (!res.ok) {
        setPanelNotice(userFacingTaskTypesMessage(res, j));
        setRules([]);
        return;
      }
      setRules(Array.isArray(j.rules) ? j.rules : []);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      devWarn("loadList", raw);
      setPanelNotice(
        raw === "Internal Server Error" || raw === "Failed to fetch"
          ? "Kon taaktypes niet laden."
          : formatTaskTypeRuleMutationError(raw)
      );
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function openCreate() {
    setEditingRule(null);
    setModalMode("create");
    setDraft(emptyPointRuleDraft());
    setLocalError(null);
    setModalOpen(true);
  }

  function openEdit(r: PointRuleRow) {
    setEditingRule(r);
    setModalMode("edit");
    setDraft(ruleToDraft(r));
    setLocalError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    const v = validateDraft(draft, modalMode);
    if (v) {
      setLocalError(v);
      return;
    }
    setSaving(true);
    setLocalError(null);
    setPanelNotice(null);
    try {
      const token = await getAccessTokenForAdminRoutes();
      if (!token) throw new Error("Niet ingelogd.");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      if (modalMode === "create") {
        const body: PointRuleCreateBody = {
          task_type: draft.task_type.trim().toLowerCase(),
          label: draft.label.trim(),
          default_minutes: Math.round(Number(draft.default_minutes)),
          basis_points: Number(String(draft.basis_points).replace(",", ".")),
          description: draft.description.trim() || null,
          active: draft.active,
        };
        const res = await fetch("/api/admin/task-type-rules", {
          method: "POST",
          ...ADMIN_API_FETCH_BASE,
          headers,
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => ({}))) as TaskTypesApiJson;
        if (!res.ok) {
          const msg = userFacingTaskTypesMessage(res, j);
          setLocalError(msg);
          setPanelNotice(msg);
          return;
        }
      } else if (editingRule?.id) {
        const body: PointRulePatchBody = {
          label: draft.label.trim(),
          default_minutes: Math.round(Number(draft.default_minutes)),
          basis_points: Number(String(draft.basis_points).replace(",", ".")),
          description: draft.description.trim() || null,
          active: draft.active,
        };
        const res = await fetch(`/api/admin/task-type-rules/${encodeURIComponent(editingRule.id)}`, {
          method: "PATCH",
          ...ADMIN_API_FETCH_BASE,
          headers,
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => ({}))) as TaskTypesApiJson;
        if (!res.ok) {
          const msg = userFacingTaskTypesMessage(res, j);
          setLocalError(msg);
          setPanelNotice(msg);
          return;
        }
      } else {
        throw new Error("Geen taaktype om bij te werken.");
      }
      setModalOpen(false);
      await loadList();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      devWarn("handleSave", raw);
      const msg =
        raw === "Internal Server Error" || raw === "Failed to fetch"
          ? "Kon taaktypes niet laden."
          : formatTaskTypeRuleMutationError(raw);
      setLocalError(msg);
      setPanelNotice(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(r: PointRuleRow) {
    setBusyId(r.id);
    setPanelNotice(null);
    try {
      const token = await getAccessTokenForAdminRoutes();
      if (!token) throw new Error("Niet ingelogd.");
      const res = await fetch(`/api/admin/task-type-rules/${encodeURIComponent(r.id)}`, {
        method: "PATCH",
        ...ADMIN_API_FETCH_BASE,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: r.active === false }),
      });
      const j = (await res.json().catch(() => ({}))) as TaskTypesApiJson;
      if (!res.ok) {
        setPanelNotice(userFacingTaskTypesMessage(res, j));
        return;
      }
      await loadList();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      devWarn("handleToggleActive", raw);
      setPanelNotice(
        raw === "Internal Server Error" || raw === "Failed to fetch"
          ? "Kon taaktypes niet laden."
          : formatTaskTypeRuleMutationError(raw)
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Dit taaktype verwijderen?")) return;
    setBusyId(id);
    setPanelNotice(null);
    try {
      const token = await getAccessTokenForAdminRoutes();
      if (!token) throw new Error("Niet ingelogd.");
      const res = await fetch(`/api/admin/task-type-rules/${encodeURIComponent(id)}`, {
        method: "DELETE",
        ...ADMIN_API_FETCH_BASE,
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as TaskTypesApiJson;
      if (!res.ok) {
        setPanelNotice(userFacingTaskTypesMessage(res, j));
        return;
      }
      await loadList();
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      devWarn("handleDelete", raw);
      setPanelNotice(
        raw === "Internal Server Error" || raw === "Failed to fetch"
          ? "Kon taaktypes niet laden."
          : formatTaskTypeRuleMutationError(raw)
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{ ...adminCard, marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Taken en puntenbeheer</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.75, lineHeight: 1.45 }}>
        Beheer taaktypes, standaard duur, punten en zichtbaarheid in de pool.
      </p>
      {panelNotice ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fca5a5", lineHeight: 1.45 }}>{panelNotice}</p>
      ) : null}
      <AdminTaskTypeRulesList
        rules={rules}
        loading={loading}
        busyId={busyId}
        onCreate={openCreate}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 p-3 sm:items-center"
          role="presentation"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-slate-900 p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-bold text-slate-100">
              {modalMode === "create" ? "Nieuw taaktype" : "Taaktype bewerken"}
            </h3>
            <AdminPointsForm draft={draft} onChange={setDraft} error={localError} mode={modalMode} />
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" style={{ ...adminBtnGhost, width: "100%" }} disabled={saving} onClick={() => setModalOpen(false)}>
                Annuleren
              </button>
              <button type="button" style={{ ...adminBtnPrimary, width: "100%" }} disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Opslaan…" : "Opslaan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
