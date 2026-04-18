import type { SupabaseClient } from "@supabase/supabase-js";

import { DEV_SEED_USER_EMAILS, DEV_SEED_USER_PASSWORD } from "@/lib/dev/fakeData";

function profileNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim();
  return local || "user";
}

/**
 * Zorgt voor auth-users + profielen (via signUp). Id's zijn geldig voor tasks.assigned_to FK.
 * @param emailsOverride — optioneel; default = kleine dev-lijst uit fakeData.
 */
export async function ensureDevTestUsers(
  supabase: SupabaseClient,
  emailsOverride?: readonly string[]
): Promise<{
  ids: string[];
  warnings: string[];
}> {
  const ids: string[] = [];
  const warnings: string[] = [];

  const emailList = emailsOverride?.length ? [...emailsOverride] : [...DEV_SEED_USER_EMAILS];

  for (const email of emailList) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: DEV_SEED_USER_PASSWORD,
    });

    if (data?.user?.id) {
      ids.push(data.user.id);
      const { error: upErr } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          first_name: profileNameFromEmail(email),
          role: "member",
        },
        { onConflict: "id" }
      );
      if (upErr) {
        warnings.push(`Profiel voor ${email}: ${upErr.message}`);
      }
      continue;
    }

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("registered") ||
        error.status === 422 ||
        error.code === "user_already_exists"
      ) {
        const { data: prof, error: qErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (qErr) {
          warnings.push(`${email}: ${qErr.message}`);
          continue;
        }
        if (prof?.id) {
          ids.push(prof.id);
        } else {
          warnings.push(
            `${email}: account bestaat al maar geen profielrij — log een keer in of verwijder user in Supabase Auth.`
          );
        }
      } else {
        warnings.push(`${email}: ${error.message}`);
      }
    }
  }

  return { ids, warnings };
}
