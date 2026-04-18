"use client";

import AdminTaskTypesPanel from "./AdminTaskTypesPanel";

/**
 * Taaktype-beheer (defaults uit `task_type_point_rules`).
 * Fouten/meldingen blijven binnen het taaktype-blok (geen globale dashboard-banner).
 */
export default function AdminPanel() {
  return (
    <div className="space-y-0">
      <AdminTaskTypesPanel />
    </div>
  );
}
