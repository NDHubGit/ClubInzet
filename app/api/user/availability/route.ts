import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD — eigen beschikbaarheidsregels.
 */
export async function GET(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { user } = auth;

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? isoDate(new Date());
  const to =
    url.searchParams.get("to") ??
    isoDate(new Date(Date.now() + 120 * 24 * 60 * 60 * 1000));

  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("availability")
    .select("id, date, available")
    .eq("user_id", user.id)
    .gte("date", from.slice(0, 10))
    .lte("date", to.slice(0, 10))
    .order("date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

type PostBody = { date?: string; available?: boolean };

/**
 * POST { date: YYYY-MM-DD, available: boolean } — upsert.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { user } = auth;

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const date = typeof body.date === "string" ? body.date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date moet YYYY-MM-DD zijn" }, { status: 400 });
  }
  const available = typeof body.available === "boolean" ? body.available : true;

  const admin = getSupabaseServiceRole();
  const { error } = await admin.from("availability").upsert(
    {
      user_id: user.id,
      date,
      available,
    },
    { onConflict: "user_id,date", ignoreDuplicates: false }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date, available });
}
