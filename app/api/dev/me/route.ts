import { NextResponse } from "next/server";

import { assertDevelopmentRoute } from "@/lib/dev/assertDevelopmentRoute";
import { DEV_ROLE_HEADER } from "@/lib/dev/fixtureUsers";
import { DEV_ADMIN_EMAIL, DEV_USER_EMAIL, fetchDevProfileByEmail } from "@/lib/dev/resolveDevProfile";

export const runtime = "nodejs";

/**
 * Development: huidige dev-gebruiker uit `profiles` (matcht JWT-less API-auth).
 */
export async function GET(request: Request) {
  const devOnly = assertDevelopmentRoute();
  if (devOnly) return devOnly;

  const role = request.headers.get(DEV_ROLE_HEADER)?.toLowerCase();
  if (role !== "user" && role !== "admin") {
    return NextResponse.json({ error: "Zet header x-clubinzet-dev-role op user of admin" }, { status: 400 });
  }

  const email = role === "admin" ? DEV_ADMIN_EMAIL : DEV_USER_EMAIL;
  const profile = await fetchDevProfileByEmail(email);
  if (!profile) {
    return NextResponse.json(
      { error: `Geen profiel voor ${email} — draai POST /api/dev/seed of ensureFixtureAuthUsers.` },
      { status: 404 }
    );
  }

  console.log("USER ID:", profile.id);

  return NextResponse.json({
    user: { id: profile.id, email: profile.email, role: profile.role },
  });
}
