import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "@/lib/supabase/adminClient";

/**
 * Service-role client: delegeert naar `getAdminClient()` — één bron, geen anon-fallback.
 * Gebruik voor serverroutes die RLS omzeilen (zelfde env als admin-auth checks).
 */
export function getSupabaseServiceRole(): SupabaseClient {
  return getAdminClient();
}
