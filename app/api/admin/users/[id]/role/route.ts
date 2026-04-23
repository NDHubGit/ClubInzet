import { NextResponse } from "next/server";

import { requireAdminRequest } from "@/lib/admin/requireAdminApi";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
type Body = { role?: unknown };

function normalizeRole(raw: unknown): "admin" | "member" | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "admin") return "admin";
  if (v === "member") return "member";
  return null;
}

/**
 * Admin-only: update `public.profiles.role` naar `admin` of `member`.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireAdminRequest(request, "admin-user-role");
  if (!gate.ok) return gate.response;

  const p = await ctx.params;
  const id = typeof p?.id === "string" ? p.id.trim() : "";
  if (!id) return NextResponse.json({ error: "Ontbrekende id" }, { status: 400 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }
  const role = normalizeRole(body.role);
  if (!role) return NextResponse.json({ error: "role moet 'admin' of 'member' zijn" }, { status: 400 });

  // Simpele safety: voorkom self-demote.
  if (role !== "admin" && String(id) === String(gate.userId)) {
    return NextResponse.json({ error: "Je kunt je eigen adminrechten niet verwijderen." }, { status: 409 });
  }

  try {
    const admin = getSupabaseServiceRole();
    const { error } = await admin.from("profiles").update({ role }).eq("id", id);
    if (error) {
      console.error("[api/admin/users/:id/role] supabase", { message: error.message, code: error.code, details: error.details });
      return NextResponse.json({ error: "SUPABASE_QUERY_ERROR" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/users/:id/role] unexpected", msg);
    return NextResponse.json({ error: "UNEXPECTED" }, { status: 500 });
  }
}

