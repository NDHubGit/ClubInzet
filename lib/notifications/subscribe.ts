/**
 * Frontend subscribe-flow (client-only imports).
 * Zie implementatie: lib/push/subscribeClient.ts
 */
export {
  requestNotificationPermission,
  subscribePushAndSave,
  subscribeUser,
  getNotificationPermissionState,
} from "@/lib/push/subscribeClient";

export type { SubscribeResult } from "@/lib/push/subscribeClient";
