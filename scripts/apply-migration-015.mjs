#!/usr/bin/env node
/**
 * Instructie-helper voor migratie 015 (geen automatische uitvoering).
 * `supabase db query` ondersteunt geen multi-statement SQL-bestanden (prepared statement).
 *
 * Gebruik: npm run db:migrate-015
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sqlRel = join("supabase", "migrations", "015_admin_tasks_points.sql");
const sqlFile = resolve(root, sqlRel);
const envLocalPath = resolve(root, ".env.local");

/**
 * @param {string} filePath
 * @param {string} key
 * @returns {string | null}
 */
function readEnvKeyFromFile(filePath, key) {
  if (!existsSync(filePath)) return null;
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const prefix = `${key}=`;
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(prefix)) continue;
    let val = trimmed.slice(prefix.length).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const out = val.trim();
    return out.length > 0 ? out : null;
  }
  return null;
}

function main() {
  console.log("[db:migrate-015] Automatische uitvoering via supabase db query is uitgeschakeld.");
  console.log("[db:migrate-015] Deze migratie bevat meerdere SQL-statements en moet handmatig worden uitgevoerd.");
  console.log("");

  if (!existsSync(sqlFile)) {
    console.log(`[db:migrate-015] FOUT: migratiebestand ontbreekt:\n  ${sqlFile}`);
    process.exit(1);
  }

  console.log("[db:migrate-015] Open Supabase > SQL Editor");
  console.log("[db:migrate-015] Plak de inhoud van:");
  console.log(`  ${sqlFile}`);
  console.log("");

  const databaseUrl = readEnvKeyFromFile(envLocalPath, "DATABASE_URL");
  if (databaseUrl) {
    console.log("[db:migrate-015] Of gebruik (vanuit projectmap, met psql geïnstalleerd):");
    console.log(`  psql "${databaseUrl}" -f ${sqlRel}`);
  } else {
    console.log("[db:migrate-015] Of gebruik (vanuit projectmap, vul je DATABASE_URL in):");
    console.log(`  psql "<DATABASE_URL>" -f ${sqlRel}`);
    console.log("");
    console.log("[db:migrate-015] Tip: zet DATABASE_URL in .env.local voor het psql-voorbeeld met echte URI.");
  }

  console.log("");
  console.log("[db:migrate-015] Na uitvoeren: schema-cache ververst (staat in de SQL: notify pgrst).");
  console.log("[db:migrate-015] Sluit af met code 1 — handmatige actie is vereist.");
  process.exit(1);
}

main();
