import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Zorgt dat er een `profiles`-rij bestaat voor de ingelogde auth-user (RLS: eigen insert).
 */
export async function ensureProfileForUser(supabase: SupabaseClient, user: User): Promise<void> {
  const { data: profile, error: selErr } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (selErr) {
    console.warn("[ensureProfileForUser] select:", selErr.message);
    return;
  }
  if (profile) return;

  const email = user.email ?? "";
  const local = email.includes("@") ? email.split("@")[0] : email;
  const { error: insErr } = await supabase.from("profiles").insert({
    id: user.id,
    email: email || null,
    role: "user",
    display_name: local || "Gebruiker",
  });
  if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
    console.warn("[ensureProfileForUser] insert:", insErr.message);
  }
}
