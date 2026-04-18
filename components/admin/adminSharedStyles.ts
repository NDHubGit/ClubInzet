import type { CSSProperties } from "react";

/** Zelfde visuele taal als `AdminDashboard` (donker thema). */
export const adminCard: CSSProperties = {
  padding: 16,
  borderRadius: 12,
  background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
};

export const adminBtnPrimary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

export const adminBtnGhost: CSSProperties = {
  ...adminBtnPrimary,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#e2e8f0",
};

export const adminInput: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 14,
};
