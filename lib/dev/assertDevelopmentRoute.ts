import { NextResponse } from "next/server";

/**
 * Blokkeert `/api/dev/*` buiten `NODE_ENV === "development"` (o.a. productiebuilds).
 * Gebruikt 404 + generieke fout om endpoints niet te fingerprinten.
 */
export function assertDevelopmentRoute(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Niet beschikbaar" }, { status: 404 });
  }
  return null;
}
