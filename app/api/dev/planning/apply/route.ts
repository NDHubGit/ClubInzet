import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { applyPlanningAssignments } from "@/lib/planning/applyPlanning";
import type { PlanningAssignment } from "@/lib/planning/generatePlanning";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  let body: { assignments?: PlanningAssignment[]; sendAssignmentEmails?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const assignments = Array.isArray(body.assignments) ? body.assignments : [];
  const result = await applyPlanningAssignments(admin, assignments, {
    sendAssignmentEmails: body.sendAssignmentEmails !== false,
  });

  return NextResponse.json({
    updated: result.updated,
    errors: result.errors,
    updatedTasks: result.updatedTasks,
  });
}
