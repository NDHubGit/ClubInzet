import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_ROWS = 5000;

/**
 * Admin: lijst van alle profielen (voor rollenbeheer).
 * Service role voor volledige lijst; toegang alleen via `requireAdminRequest`.
 */
export async function GET(request: Request) {
  const gate = await requireAdminRequest(request, "admin-profiles");
  if (!gate.ok) return gate.response;

  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name, name, first_name, last_name, role")
    .order("email", { ascending: true })
    .limit(MAX_ROWS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data ?? [] });
}

