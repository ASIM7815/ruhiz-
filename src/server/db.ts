import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "./env";

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Parameterised SQL over Neon's HTTP driver.
 * Always use the tagged template (`sql\`... ${value}\``) or `sql.query(text, params)`;
 * never build SQL by string concatenation with user input.
 */
export function db() {
  if (!client) client = neon(env.databaseUrl);
  return client;
}

/** Typed query helper: returns rows cast to T. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Runs several statements atomically (non-interactive transaction). */
export async function tx(statements: { text: string; params?: unknown[] }[]) {
  const sql = db();
  return sql.transaction(statements.map((s) => sql.query(s.text, s.params ?? [])));
}
