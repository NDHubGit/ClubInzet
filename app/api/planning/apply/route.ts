import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { applyPlanningAssignments } from "@/lib/planning/applyPlanning";
import type { PlanningAssignment } from "@/lib/planning/generatePlanning";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  assignments?: PlanningAssignment[];
  sendAssignmentEmails?: boolean;
};

/**
 * Past teamplanning toe (server-side + optioneel Resend). Alleen admin.
 * Geen knop in de MVP-UI; endpoint blijft beschikbaar voor integraties of toekomstige scheduling.
 */
export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { user } = auth;

  const adminOk = await isUserAdmin(user.id);
  if (!adminOk) {
    return NextResponse.json({ error: "Forbidden — alleen admin" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const assignments = Array.isArray(body.assignments) ? body.assignments : [];
  const admin = getSupabaseServiceRole();
  const result = await applyPlanningAssignments(admin, assignments, {
    sendAssignmentEmails: body.sendAssignmentEmails !== false,
  });

  return NextResponse.json({
    updated: result.updated,
    errors: result.errors,
    updatedTasks: result.updatedTasks,
  });
}
