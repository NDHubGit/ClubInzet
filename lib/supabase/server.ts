import { createServerClient as createSupabaseSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase (cookies) — gebruik in Route Handlers en Server Components.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createSupabaseSSRClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* setAll van Server Component zonder mutable cookies */
        }
      },
    },
  });
}

/** Zelfde als `createSupabaseServerClient` — alias voor duidelijke import. */
export const createServerClient = createSupabaseServerClient;
