import type { ReactNode } from "react";

/**
 * Admin-routes: geen extra server-fetch hier; auth gebeurt in de client-pagina + API-routes.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
