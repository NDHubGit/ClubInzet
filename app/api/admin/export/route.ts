import { NextResponse } from "next/server";

import { fetchProfilesAndAssignedTasks, memberRowsForExport } from "@/lib/admin/fetchAdminMemberData";
import { csvEscapeCell, toCsvRows } from "@/lib/admin/csvEscape";
import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * CSV-export: Naam, Email, Taken, Punten, Status (Behaald / Niet behaald).
 */
export async function GET(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const ok = await isUserAdmin(auth.user.id);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden — alleen admin" }, { status: 403 });
  }

  try {
    const admin = getSupabaseServiceRole();
    const { profiles, tasks } = await fetchProfilesAndAssignedTasks(admin);
    const rows = memberRowsForExport(profiles, tasks);
    rows.sort((a, b) => a.name.localeCompare(b.name, "nl"));

    const headers = ["Naam", "Email", "Taken", "Punten", "Status"];
    const dataRows = rows.map((r) => [
      csvEscapeCell(r.name),
      csvEscapeCell(r.email ?? ""),
      String(r.total_tasks),
      String(r.total_points),
      csvEscapeCell(r.status),
    ]);

    const csv = toCsvRows(headers, dataRows);
    const filename = `clubinzet-leden-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
