#!/usr/bin/env node
// Applies db/migrations/*.sql in order, once each, inside a transaction.
// Usage: npm run db:migrate            (apply pending)
//        npm run db:migrate -- --status (list applied / pending, no changes)
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { Pool } from "@neondatabase/serverless";

// Same reason as src/instrumentation.ts: tolerate high-latency networks.
setDefaultAutoSelectFamilyAttemptTimeout(2500);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env.local"));
loadEnv(join(root, ".env"));

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("NEON_DATABASE_URL is not set (.env.local).");
  process.exit(1);
}

const dir = join(root, "db", "migrations");
const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const pool = new Pool({ connectionString: url });
const client = await pool.connect();

try {
  await client.query(`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`);
  const { rows } = await client.query(`select version from schema_migrations`);
  const applied = new Set(rows.map((r) => r.version));
  const pending = files.filter((f) => !applied.has(f));

  if (process.argv.includes("--status")) {
    for (const f of files) console.log(`${applied.has(f) ? "applied " : "PENDING "} ${f}`);
    process.exit(0);
  }
  if (!pending.length) console.log("No pending migrations.");

  for (const f of pending) {
    const sqlText = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`Applying ${f} ... `);
    await client.query("begin");
    try {
      await client.query(sqlText);
      await client.query(`insert into schema_migrations (version) values ($1)`, [f]);
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.log("FAILED");
      throw e;
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
}
