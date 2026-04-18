import { createClient } from "@supabase/supabase-js";

export async function getUserFromBearer(accessToken: string | null) {
  if (!accessToken) return { user: null as null, error: "Geen token" as const };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { user: null as null, error: "Server misconfiguratie" as const };
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null as null, error: error?.message ?? "Ongeldige sessie" };
  }
  return { user, error: null as null };
}

export function bearerFromRequest(request: Request): string | null {
  const h = request.headers.get("authorization")?.trim();
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  const token = m?.[1]?.trim();
  return token || null;
}
