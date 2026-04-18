"use client";

import type { PointRuleRow } from "@/lib/admin/pointsAdminTypes";

import { adminInput } from "./adminSharedStyles";

export type AdminPointsFormDraft = {
  task_type: string;
  label: string;
  default_minutes: string;
  basis_points: string;
  description: string;
  active: boolean;
};

export function emptyPointRuleDraft(): AdminPointsFormDraft {
  return {
    task_type: "",
    label: "",
    default_minutes: "60",
    basis_points: "1",
    description: "",
    active: true,
  };
}

export function ruleToDraft(r: PointRuleRow): AdminPointsFormDraft {
  return {
    task_type: r.task_type != null ? String(r.task_type) : "",
    label: r.label != null ? String(r.label) : "",
    default_minutes: String(r.default_minutes ?? 60),
    basis_points: String(r.basis_points ?? 0),
    description: r.description != null ? String(r.description) : "",
    active: r.active !== false,
  };
}

export type AdminPointsFormProps = {
  draft: AdminPointsFormDraft;
  onChange: (next: AdminPointsFormDraft) => void;
  error: string | null;
  mode: "create" | "edit";
};

export default function AdminPointsForm({ draft, onChange, error, mode }: AdminPointsFormProps) {
  function patch(p: Partial<AdminPointsFormDraft>) {
    onChange({ ...draft, ...p });
  }

  const labelStyle = { display: "block" as const, fontSize: 12, opacity: 0.75, marginBottom: 4 };
  const fieldGap = { marginBottom: 12 };

  return (
    <div>
      {error ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fca5a5", whiteSpace: "pre-wrap" }}>{error}</p>
      ) : null}
      <div style={fieldGap}>
        <label style={labelStyle}>Taaktype-sleutel (uniek) {mode === "edit" ? "— niet wijzigen" : ""}</label>
        <input
          type="text"
          value={draft.task_type}
          onChange={(e) => patch({ task_type: e.target.value.toLowerCase() })}
          style={adminInput}
          placeholder="bijv. bardienst"
          disabled={mode === "edit"}
          autoComplete="off"
        />
      </div>
      <div style={fieldGap}>
        <label style={labelStyle}>Naam (weergave)</label>
        <input
          type="text"
          value={draft.label}
          onChange={(e) => patch({ label: e.target.value })}
          style={adminInput}
          placeholder="Naam in overzichten"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Standaard minuten</label>
          <input
            type="number"
            min={1}
            step={1}
            value={draft.default_minutes}
            onChange={(e) => patch({ default_minutes: e.target.value })}
            style={adminInput}
          />
        </div>
        <div>
          <label style={labelStyle}>Punten</label>
          <input
            type="number"
            min={0}
            step={0.001}
            value={draft.basis_points}
            onChange={(e) => patch({ basis_points: e.target.value })}
            style={adminInput}
          />
        </div>
      </div>
      <div style={fieldGap}>
        <label style={labelStyle}>Omschrijving (optioneel)</label>
        <textarea
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          style={{ ...adminInput, resize: "vertical" as const, minHeight: 56 }}
        />
      </div>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.target.checked })} />
        Actief in de pool (o.a. defaults voor handmatige meldingen)
      </label>
    </div>
  );
}
