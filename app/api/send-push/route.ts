import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";
import { isUserAdmin } from "@/lib/auth/isAdmin";
import { sendPush } from "@/lib/notifications/sendPush";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  message?: string;
  title?: string;
};

/**
 * POST { userId, message, title? }
 * Haalt alle push_subscriptions voor userId op en stuurt naar elk device.
 * SUPABASE_SERVICE_ROLE_KEY alleen server-side in deze route.
 *
 * Beveiliging: als env PUSH_REQUIRE_ADMIN=true, alleen profiles.role=admin.
 * Zonder die env (MVP): elke ingelogde gebruiker mag send-push aanroepen.
 */
export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }
  const { user } = auth;

  if (process.env.PUSH_REQUIRE_ADMIN === "true") {
    const adminOk = await isUserAdmin(user.id);
    if (!adminOk) {
      return NextResponse.json({ error: "Forbidden — alleen admin (PUSH_REQUIRE_ADMIN)" }, { status: 403 });
    }
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const message = typeof body.message === "string" ? body.message : "";
  if (!userId || !message) {
    return NextResponse.json({ error: "userId en message zijn verplicht" }, { status: 400 });
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "ClubInzet";

  const admin = getSupabaseServiceRole();
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", userId);

  if (subErr) {
    console.error("[send-push]", subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const row of subs || []) {
    try {
      await sendPush(
        { endpoint: row.endpoint, keys: row.keys as Record<string, unknown> },
        {
          title,
          body: message,
          data: { type: "admin_push", targetUserId: userId },
        }
      );
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    errors: errors.length ? errors : undefined,
  });
}
