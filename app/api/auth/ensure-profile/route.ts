import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { bearerFromRequest, getUserFromBearer } from "@/lib/auth/getUserFromBearer";
import { tryClientSelectInsertProfile } from "@/lib/auth/profileShared";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Profiel alleen via dezelfde authenticated Supabase-client als de gebruiker (anon + JWT),
 * nooit service role voor user data.
 * Auth: `Authorization: Bearer` (voorrang) of cookie-sessie via `createServerClient`.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let user: User | null = null;
  let supabase: SupabaseClient;

  const token = bearerFromRequest(request);
  if (token) {
    const { user: u, error } = await getUserFromBearer(token);
    if (!u || error) {
      console.warn("[api/auth/ensure-profile] bearer invalid", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    user = u;
    supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  } else {
    const serverSb = await createServerClient();
    const {
      data: { user: u },
      error,
    } = await serverSb.auth.getUser();
    if (!u || error) {
      console.warn("[api/auth/ensure-profile] cookie session invalid", error?.message);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    user = u;
    supabase = serverSb;
  }

  const attempt = await tryClientSelectInsertProfile(supabase, user);
  if (!attempt.profile) {
    console.error("[api/auth/ensure-profile] geen profiel", {
      userId: user.id,
      selectError: attempt.selectError,
      insertError: attempt.insertError,
    });
    return NextResponse.json(
      { error: attempt.selectError?.message || attempt.insertError?.message || "Profiel niet beschikbaar." },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile: attempt.profile });
}
