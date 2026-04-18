/** Basis-URL voor links in e-mails (geen trailing slash). */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return raw.replace(/\/+$/, "");
}
