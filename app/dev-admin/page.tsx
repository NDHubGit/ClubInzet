import { redirect } from "next/navigation";

/**
 * Oude shortcut — gebruik /admin (met login).
 */
export default function DevAdminRedirectPage() {
  redirect("/admin");
}
