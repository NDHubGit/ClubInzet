import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { seedClubRealisticData } from "@/lib/dev/clubRealisticSeed";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Development-only: 12 testgebruikers, 7 teams, team_members, ≥20 realistische taken.
 */
export async function POST() {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  try {
    const result = await seedClubRealisticData(admin);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/dev/seed/club-realistic]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
