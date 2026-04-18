import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { getDevActorIdFromRequest } from "@/lib/dev/resolveDevProfile";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

/**
 * Development-only: volledige data voor admin/home (server gebruikt service role).
 * `x-clubinzet-dev-role`: actor-id uit `profiles` (user1@test.nl / admin@test.nl).
 */
export async function GET(request: Request) {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const admin = getSupabaseServiceRole();

  const [tasksRes, profRes] = await Promise.all([
    admin.from("tasks").select("*").order("created_at", { ascending: false }),
    admin.from("profiles").select("*"),
  ]);

  const profiles = Array.isArray(profRes.data) ? profRes.data : [];
  const actorUserId = (await getDevActorIdFromRequest(request)) ?? profiles[0]?.id ?? null;

  return NextResponse.json({
    tasks: Array.isArray(tasksRes.data) ? tasksRes.data : [],
    teams: [],
    teamsCount: 0,
    profiles,
    actorUserId,
    errors: {
      tasks: tasksRes.error?.message,
      profiles: profRes.error?.message,
    },
  });
}
