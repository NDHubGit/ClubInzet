/**
 * Voer uit: node scripts/generate-vapid-keys.mjs
 * Kopieer de keys naar .env.local als NEXT_PUBLIC_VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Plak in .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
