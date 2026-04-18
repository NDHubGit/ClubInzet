import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

let client = null;

/** Zelfde singleton als `getSupabase()` — alias voor imports zoals `createBrowserClient()`. */
export function createBrowserClient() {
  return getSupabase();
}

/**
 * Browser-client (cookies via @supabase/ssr — zelfde sessie als server + middleware).
 */
export function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[supabase] Ontbrekende env: zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  if (!client) {
    client = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    });
    if (process.env.NODE_ENV === "development") {
      console.debug("[supabase] browser client (SSR cookies)", {
        url: supabaseUrl ? `${supabaseUrl.slice(0, 28)}…` : "(leeg)",
        hasKey: Boolean(supabaseAnonKey),
      });
    }
  }
  return client;
}

export const supabase = getSupabase();
