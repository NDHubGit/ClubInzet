import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppBaseUrl } from "@/lib/email/appUrl";
import { getEmailFrom, getResend } from "@/lib/email/resendMail";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Verstuurt toewijzingsmail. True alleen als Resend de mail daadwerkelijk heeft geaccepteerd.
 */
export async function sendTaskAssignmentEmail(
  supabase: SupabaseClient,
  taskId: string
): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY ontbreekt — geen toewijzingsmail");
    return false;
  }

  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .select("id, title, task_type, task_date, team_id, assigned_to")
    .eq("id", taskId)
    .maybeSingle();

  if (tErr || !task?.assigned_to) {
    console.warn("[email] taak niet gevonden of geen assignee", taskId, tErr?.message);
    return false;
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", task.assigned_to)
    .maybeSingle();

  if (pErr || !profile?.email) {
    console.warn("[email] geen e-mail voor gebruiker", task.assigned_to, pErr?.message);
    return false;
  }

  const title = (task.title && String(task.title).trim()) || String(task.task_type ?? "Clubtaak");
  const teamRef = task.team_id ? `${String(task.team_id).slice(0, 8)}…` : "—";
  const datum =
    task.task_date != null ? String(task.task_date).slice(0, 10) : "—";
  const appUrl = getAppBaseUrl();

  const html = `
    <p>Hallo${profile.display_name ? ` ${escapeHtml(String(profile.display_name))}` : ""},</p>
    <p>Er is een nieuwe clubtaak aan jou toegewezen.</p>
    <ul>
      <li><strong>Taak:</strong> ${escapeHtml(title)}</li>
      <li><strong>Datum:</strong> ${escapeHtml(datum)}</li>
      <li><strong>Team-id:</strong> ${escapeHtml(teamRef)}</li>
    </ul>
    <p><a href="${escapeHtml(appUrl)}">Open ClubInzet</a></p>
  `.trim();

  const text = [
    "Nieuwe clubtaak toegewezen",
    "",
    `Taak: ${title}`,
    `Datum: ${datum}`,
    `Team-id: ${teamRef}`,
    "",
    `App: ${appUrl}`,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: [String(profile.email)],
    subject: "Nieuwe clubtaak toegewezen",
    html,
    text,
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return false;
  }

  return true;
}
