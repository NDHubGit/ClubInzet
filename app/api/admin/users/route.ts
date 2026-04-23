import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Row = { id: string; email: string | null; display_name: string | null; role: string | null };

const MAX_ROWS = 5000;

/**
 * Admin-only: lijst van alle profielen voor rollenbeheer.
 * Bron: `public.profiles` (service role), beveiligd met `requireAdminRequest`.
 */
export async function GET(request: Request) {
  const gate = await requireAdminRequest(request, "admin-users");
  if (!gate.ok) return gate.response;

  try {
    const admin = getSupabaseServiceRole();
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, display_name, role")
      .order("display_name", { ascending: true })
      .order("email", { ascending: true })
      .limit(MAX_ROWS);

    if (error) {
      console.error("[api/admin/users] supabase", { message: error.message, code: error.code, details: error.details });
      return NextResponse.json({ error: "SUPABASE_QUERY_ERROR" }, { status: 500 });
    }

    const rows: Row[] = (Array.isArray(data) ? data : []).map((r) => ({
      id: String((r as { id: string }).id),
      email: (r as { email?: string | null }).email ?? null,
      display_name: (r as { display_name?: string | null }).display_name ?? null,
      role: (r as { role?: string | null }).role ?? null,
    }));

    return NextResponse.json({ rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/users] unexpected", msg);
    return NextResponse.json({ error: "UNEXPECTED" }, { status: 500 });
  }
}

