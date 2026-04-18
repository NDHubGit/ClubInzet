import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/auth/getRequestUser";

/** Huidige sessie + profiel (zelfde bron als server `getRequestUser`). */
export async function GET(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email ?? null,
    },
    profile: auth.profile,
  });
}
