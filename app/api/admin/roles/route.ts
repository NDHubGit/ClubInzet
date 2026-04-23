import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = { profileId?: unknown; role?: unknown };

function normalizeRole(raw: unknown): "admin" | "member" | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "admin") return "admin";
  if (v === "member") return "member";
  return null;
}

/**
 * Admin: wijzig `profiles.role` tussen `member` en `admin`.
 * Auth: `requireAdminRequest` (Bearer/cookies) + service role update.
 */
export async function POST(request: Request) {
  const gate = await requireAdminRequest(request, "admin-roles");
  if (!gate.ok) return gate.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const profileId = typeof body.profileId === "string" ? body.profileId.trim() : String(body.profileId ?? "").trim();
  const role = normalizeRole(body.role);
  if (!profileId) {
    return NextResponse.json({ error: "profileId verplicht" }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ error: "role moet 'member' of 'admin' zijn" }, { status: 400 });
  }

  // Voorkom dat een admin zichzelf per ongeluk de-admin maakt.
  if (role !== "admin" && String(profileId) === String(gate.userId)) {
    return NextResponse.json({ error: "Je kunt je eigen adminrechten niet verwijderen." }, { status: 409 });
  }

  const srv = getSupabaseServiceRole();
  const { data, error } = await srv
    .from("profiles")
    .update({ role })
    .eq("id", profileId)
    .select("id, role")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Profiel niet gevonden" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile: data });
}

