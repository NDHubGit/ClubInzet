/**
 * Optionele admin-auth debug-logs (standaard uit).
 * Alleen actief bij `CLUBINZET_DEBUG_ADMIN_AUTH=1` in `.env.local`.
 */
export function adminAuthDebugEnabled(): boolean {
  return process.env.CLUBINZET_DEBUG_ADMIN_AUTH === "1";
}

/** Vaste prefix zodat je in de terminal eenvoudig kunt filteren: `grep admin-auth-debug` */
const PREFIX = "[admin-auth-debug]";

export function adminAuthDebug(tag: string, payload: Record<string, unknown>): void {
  if (!adminAuthDebugEnabled()) return;
  console.log(`${PREFIX} ${tag}`, JSON.stringify(payload));
}
