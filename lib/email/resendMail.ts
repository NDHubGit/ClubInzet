import { Resend } from "resend";

let resend: Resend | null = null;

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "ClubInzet <onboarding@resend.dev>";
}
