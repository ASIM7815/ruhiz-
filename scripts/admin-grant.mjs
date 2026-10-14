#!/usr/bin/env node
// Grants (or revokes) the explicit admin role. Trusted, server-side only: run it from a machine
// that holds the database credentials. The account must already exist and have a verified email.
//
//   npm run admin:grant -- someone@example.com            grant
//   npm run admin:grant -- --revoke someone@example.com   revoke
//   npm run admin:grant -- --list                         list current admins
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { Pool } from "@neondatabase/serverless";

setDefaultAutoSelectFamilyAttemptTimeout(2500);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(root, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  } catch {}
}
const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("NEON_DATABASE_URL is not set (.env.local).");
  process.exit(1);
}

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const list = args.includes("--list");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

const pool = new Pool({ connectionString: url });
try {
  if (list) {
    const { rows } = await pool.query(
      `select u.email, u."emailVerified" as verified, r.granted_at, r.granted_by from user_roles r join neon_auth."user" u on u.id = r.user_id where r.role = 'admin' order by r.granted_at`,
    );
    for (const r of rows) console.log(`${r.email}  verified=${r.verified}  since ${new Date(r.granted_at).toISOString()} (${r.granted_by})`);
    if (!rows.length) console.log("No administrators.");
  } else {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      console.error("Usage: npm run admin:grant -- [--revoke] <email>");
      process.exit(1);
    }
    const { rows } = await pool.query(`select id, "emailVerified" as verified from neon_auth."user" where lower(email) = $1`, [email]);
    if (!rows.length) {
      console.error(`No account with ${email} exists yet. Ask them to sign up and verify their email, then run this again.`);
      process.exit(2);
    }
    const u = rows[0];
    if (revoke) {
      const r = await pool.query(`delete from user_roles where user_id = $1 and role = 'admin'`, [u.id]);
      console.log(r.rowCount ? `Revoked admin from ${email}.` : `${email} was not an admin.`);
    } else {
      if (!u.verified) {
        console.error(`${email} has not verified their email yet. Admin is only granted to verified accounts.`);
        process.exit(3);
      }
      const r = await pool.query(`insert into user_roles (user_id, role, granted_by) values ($1, 'admin', 'admin-grant script') on conflict do nothing`, [u.id]);
      console.log(r.rowCount ? `Granted admin to ${email}.` : `${email} is already an admin.`);
    }
  }
} finally {
  await pool.end();
}
