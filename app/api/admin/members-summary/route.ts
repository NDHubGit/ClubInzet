import { NextResponse } from "next/server";

import { debugAdminRouteGateOutcome, debugAdminRouteIncoming } from "@/lib/admin/debugAdminRouteIncoming";
import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import { fetchProfilesAndAssignedTasks, memberRowsForExport } from "@/lib/admin/fetchAdminMemberData";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Geaggregeerde ledenstatistieken (geen ruwe takenlijst naar de client).
 * Auth: identiek aan `task-type-rules` — `requireAdminRequest` +zelfde Bearer/cookie-flow.
 */
export async function GET(request: Request) {
  debugAdminRouteIncoming(request, "members-summary");

  const gate = await requireAdminRequest(request, "members-summary");
  debugAdminRouteGateOutcome("members-summary", gate);
  if (!gate.ok) {
    return gate.response;
  }

  try {
    const admin = getSupabaseServiceRole();
    const { profiles, tasks } = await fetchProfilesAndAssignedTasks(admin);
    const rows = memberRowsForExport(profiles, tasks);
    rows.sort((a, b) => a.name.localeCompare(b.name, "nl"));
    return NextResponse.json({ rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
