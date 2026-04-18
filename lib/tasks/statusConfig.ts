import type { CSSProperties } from "react";

import { normalizeTaskStatus } from "@/lib/planning/taskStatus";

/**
 * Centrale statuslabels en kleur-tokens voor de hele app.
 * Geen emoji’s — rustig voor ouders/vrijwilligers.
 */
export const statusConfig = {
  /** Legacy pool-status (sommige rijen); zelfde weergave als `planned`. */
  open: { label: "Open", color: "blue" as const },
  planned: { label: "Open", color: "blue" as const },
  claimed: { label: "In afwachting", color: "orange" as const },
  approved: { label: "Voltooid", color: "green" as const },
  completed: { label: "Voltooid", color: "green" as const },
  missed: { label: "Gemist", color: "red" as const },
  rejected: { label: "Afgekeurd", color: "red" as const },
} as const;

export type StatusConfigKey = keyof typeof statusConfig;
type ColorToken = "blue" | "orange" | "green" | "red" | "slate";

/** Tailwind-equivalente kleuren (inline styles / donker thema). */
const COLOR_STYLES: Record<ColorToken, { badge: CSSProperties; surface: CSSProperties }> = {
  blue: {
    badge: {
      background: "rgba(59, 130, 246, 0.12)",
      color: "#93c5fd",
      border: "1px solid rgba(59, 130, 246, 0.45)",
    },
    surface: {
      borderColor: "rgba(59, 130, 246, 0.28)",
      background: "linear-gradient(165deg, rgba(37, 99, 235, 0.1) 0%, #1a2332 52%)",
    },
  },
  orange: {
    badge: {
      background: "rgba(249, 115, 22, 0.1)",
      color: "#fdba74",
      border: "1px solid #fb923c",
    },
    surface: {
      borderColor: "rgba(251, 146, 60, 0.32)",
      background: "linear-gradient(165deg, rgba(249, 115, 22, 0.08) 0%, #1a2332 52%)",
    },
  },
  green: {
    badge: {
      background: "rgba(34, 197, 94, 0.14)",
      color: "#bbf7d0",
      border: "1px solid rgba(34, 197, 94, 0.38)",
    },
    surface: {
      borderColor: "rgba(34, 197, 94, 0.28)",
      background: "linear-gradient(165deg, rgba(34, 197, 94, 0.1) 0%, #1a2332 52%)",
    },
  },
  red: {
    badge: {
      background: "rgba(239, 68, 68, 0.1)",
      color: "#fca5a5",
      border: "1px solid #f87171",
    },
    surface: {
      borderColor: "rgba(248, 113, 113, 0.3)",
      background: "linear-gradient(165deg, rgba(239, 68, 68, 0.09) 0%, #1a2332 52%)",
    },
  },
  slate: {
    badge: {
      background: "rgba(148, 163, 184, 0.1)",
      color: "#e2e8f0",
      border: "1px solid rgba(148, 163, 184, 0.28)",
    },
    surface: {
      borderColor: "rgba(148, 163, 184, 0.22)",
      background: "linear-gradient(165deg, rgba(148, 163, 184, 0.06) 0%, #1a2332 52%)",
    },
  },
};

function resolveConfigKey(raw: string | null | undefined): StatusConfigKey | "pending" {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "opgepakt") return "claimed";
  if (s === "planned") return "planned";

  const n = normalizeTaskStatus(raw);
  if (n === "open") return "open";
  if (n === "pending") return "pending";
  if (n === "planned") return "planned";
  if (n === "claimed") return "claimed";
  if (n === "approved") return "approved";
  if (n === "completed") return "completed";
  if (n === "missed") return "missed";
  if (n === "rejected") return "rejected";
  return "open";
}

function colorTokenFor(raw: string | null | undefined): ColorToken {
  const key = resolveConfigKey(raw);
  if (key === "pending") return "orange";
  return statusConfig[key].color;
}

/** Zichtbare tekst op basis van `task.status`. */
export function getStatusLabel(raw: string | null | undefined): string {
  const key = resolveConfigKey(raw);
  if (key === "pending") return "In afwachting";
  return statusConfig[key].label;
}

/** Pill-styling voor badges. */
export function getStatusBadgeStyle(raw: string | null | undefined): CSSProperties {
  return COLOR_STYLES[colorTokenFor(raw)].badge;
}

/** Subtiele kaartachtergrond / rand. */
export function getTaskCardSurfaceStyle(raw: string | null | undefined): CSSProperties {
  return COLOR_STYLES[colorTokenFor(raw)].surface;
}
