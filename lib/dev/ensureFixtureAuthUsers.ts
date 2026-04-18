import { DEV_ADMIN_ID, DEV_USER1_ID } from "@/lib/dev/fixtureUsers";
import { DEV_SEED_USER_PASSWORD } from "@/lib/dev/fakeData";
import { getSupabaseServiceRole } from "@/lib/supabase/admin";

type Fixture = { id: string; email: string; profileRole: "member" | "admin" };

const FIXTURES: Fixture[] = [
  { id: DEV_USER1_ID, email: "user1@test.nl", profileRole: "member" },
  { id: DEV_ADMIN_ID, email: "admin@test.nl", profileRole: "admin" },
];

/**
 * Maakt vaste auth.users + profiles aan (id expliciet), idempotent.
 */
export async function ensureFixtureAuthUsers(): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
  const admin = getSupabaseServiceRole();

  for (const f of FIXTURES) {
    const { data: existingProf } = await admin.from("profiles").select("id").eq("id", f.id).maybeSingle();
    if (existingProf?.id) continue;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      id: f.id,
      email: f.email,
      password: DEV_SEED_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: f.email.split("@")[0] ?? "dev" },
    });

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: byEmail } = await admin.from("profiles").select("id").eq("email", f.email).maybeSingle();
        if (byEmail?.id) {
          warnings.push(`${f.email}: bestaat al met ander id (${byEmail.id}) — fixture overslaan of user verwijderen.`);
        } else {
          warnings.push(`${f.email}: ${createErr.message}`);
        }
      } else {
        warnings.push(`${f.email}: ${createErr.message}`);
      }
      continue;
    }

    if (!created?.user?.id) {
      warnings.push(`${f.email}: createUser zonder user terug`);
      continue;
    }

    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: f.id,
        email: f.email,
        first_name: f.email.split("@")[0] ?? "dev",
        role: f.profileRole,
      },
      { onConflict: "id" }
    );
    if (pErr) warnings.push(`Profiel ${f.email}: ${pErr.message}`);
  }

  return { warnings };
}
