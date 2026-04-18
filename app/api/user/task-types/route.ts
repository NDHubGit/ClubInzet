import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/getRequestUser";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Actieve taaktypes voor handmatige invoer (/user) — bron: `task_type_point_rules`.
 * Alfabetisch op `label` (server-side order).
 */
export async function GET(request: Request) {
  const { auth } = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const admin = getSupabaseServiceRole();
  const { data, error } = await admin
    .from("task_type_point_rules")
    .select("task_type, label")
    .eq("active", true)
    .order("label", { ascending: true });

  if (error) {
    console.error("[api/user/task-types]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [];
  for (const row of data ?? []) {
    const tt = typeof row.task_type === "string" ? row.task_type.trim().toLowerCase() : "";
    if (!tt || seen.has(tt)) continue;
    seen.add(tt);
    const lab =
      typeof row.label === "string" && row.label.trim()
        ? row.label.trim()
        : tt;
    options.push({ value: tt, label: lab });
  }

  return NextResponse.json({ options });
}
