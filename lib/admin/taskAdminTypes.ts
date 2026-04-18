/** Rij voor admin-takenlijst (subset van `tasks` + optioneel `admin_active`). */
export type TaskAdminListRow = {
  id: string;
  title?: string | null;
  task_type?: string | null;
  description?: string | null;
  task_date?: string | null;
  /** Alleen aanwezig als DB-migratie `005_club_planning_model.sql` is toegepast. */
  start_time?: string | null;
  duration_minutes?: number | null;
  points?: number | null;
  override_points?: number | null;
  status?: string | null;
  source?: string | null;
  assigned_to?: string | null;
  team_id?: string | null;
  admin_active?: boolean | null;
  created_at?: string | null;
};

export type TaskAdminCreateBody = {
  title?: string;
  task_type: string;
  description?: string | null;
  task_date?: string | null;
  duration_minutes?: number;
  points?: number;
  status?: string;
  source?: string;
  assigned_to?: string | null;
  team_id?: string | null;
  admin_active?: boolean;
};

export type TaskAdminPatchBody = Partial<TaskAdminCreateBody> & {
  override_points?: number | null;
};
