/**
 * Client-side: toestemming + push subscribe + POST naar /api/push/subscribe.
 * Werkt op HTTPS of localhost; in development staat next-pwa meestal uit (geen actieve SW).
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    out[i] = rawData.charCodeAt(i);
  }
  return out;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "denied";
  }
  return Notification.requestPermission();
}

export type SubscribeResult = { ok: true } | { ok: false; error: string };

/**
 * Subscribeert via actieve service worker en slaat subscription op (Bearer JWT).
 */
export async function subscribePushAndSave(getAccessToken: () => Promise<string | null>): Promise<SubscribeResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false, error: "Geen Service Worker (productie-build nodig, of HTTPS)." };
  }

  const perm = await requestNotificationPermission();
  if (perm !== "granted") {
    return { ok: false, error: perm === "denied" ? "Notificaties geblokkeerd" : "Geen toestemming" };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) {
    return { ok: false, error: "VAPID-sleutel ontbreekt (NEXT_PUBLIC_VAPID_PUBLIC_KEY)." };
  }

  const registration = await navigator.serviceWorker.ready;
  const key = urlBase64ToUint8Array(vapid);
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as BufferSource,
  });

  const token = await getAccessToken();
  const json = sub.toJSON();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!token) {
    return { ok: false, error: "Niet ingelogd" };
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ subscription: json }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg = typeof errBody.error === "string" ? errBody.error : res.statusText;
    return { ok: false, error: msg || "Opslaan mislukt" };
  }

  return { ok: true };
}

/** MVP-naam: permission + subscribe + opslaan in Supabase (via API). */
export const subscribeUser = subscribePushAndSave;

export function getNotificationPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
}
