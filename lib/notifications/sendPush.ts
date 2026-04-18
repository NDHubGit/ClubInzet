import webpush from "web-push";

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh?: string; auth?: string } | Record<string, unknown>;
};

export type PushPayload = {
  title?: string;
  body?: string;
  data?: unknown;
};

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:dev@clubinzet.nl";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID: zet NEXT_PUBLIC_VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Verstuurt één Web Push via web-push (Node).
 */
export async function sendPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload
): Promise<void> {
  ensureVapid();

  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") {
    throw new Error("Subscription keys ontbreken (p256dh/auth)");
  }

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
    },
    JSON.stringify({
      title: payload.title ?? "ClubInzet",
      body: payload.body ?? "",
      data: payload.data,
    })
  );
}

/** @deprecated gebruik sendPush */
export const sendPushNotification = sendPush;
