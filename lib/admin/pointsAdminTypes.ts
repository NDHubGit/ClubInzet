/** Rij in `task_type_point_rules` (configureerbare standaard duur/punten). */
export type PointRuleRow = {
  id: string;
  task_type: string;
  label: string;
  default_minutes: number;
  basis_points: number;
  description: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PointRuleCreateBody = {
  task_type: string;
  label: string;
  default_minutes?: number;
  basis_points?: number;
  description?: string | null;
  active?: boolean;
};

export type PointRulePatchBody = Partial<PointRuleCreateBody>;
