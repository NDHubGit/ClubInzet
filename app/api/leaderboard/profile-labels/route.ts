import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_IDS = 200;

/**
 * Profielen voor klassement (display_name, e-mail, …): client-RLS laat geen vreemde profielen toe,
 * daarom server-side met service role —zelfde bron als admin-ledenoverzicht.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.ids;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "ids (array) verplicht" }, { status: 400 });
  }

  const ids = [...new Set(raw.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const srv = getSupabaseServiceRole();
  const { data, error } = await srv
    .from("profiles")
    .select("id, email, name, display_name, first_name, last_name")
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles: data ?? [] });
}
