import { getSupabase } from "./supabase";

function logInsertError(prefix, error) {
  console.error(prefix, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    raw: error,
  });
}

/**
 * Voegt een taak toe voor de ingelogde gebruiker (user_id = auth.uid() via sessie).
 */
export async function submitClubinzetTask({ task_type, duration_minutes }) {
  const supabase = getSupabase();

  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr) {
    console.error("[submitClubinzetTask] getSession:", sessionErr);
  }

  const user = session?.user ?? null;
  if (!user) {
    throw new Error("Niet ingelogd");
  }

  const user_id = user.id;
  const points = duration_minutes / 60;

  console.log("[submitClubinzetTask]", { user_id, task_type, duration_minutes, points });

  const { error } = await supabase.from("tasks").insert([
    {
      user_id,
      task_type,
      duration_minutes,
      points,
      created_by: user_id,
    },
  ]);

  if (error) {
    logInsertError("[submitClubinzetTask] insert failed", error);
    throw error;
  }
}
