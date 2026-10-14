import { body, route } from "@/server/http";
import { q } from "@/server/db";
import { identityReveal } from "@/server/schemas";
import { getMe } from "@/server/repo/profiles";

/**
 * PUT  /api/me/identity  — reveal your identity. Requires every detail plus `confirm: true`.
 * DELETE /api/me/identity — go back to anonymous (Identity Saver) everywhere, immediately.
 *
 * Identity is hidden by default and stays hidden across logins, refreshes and devices because it
 * is stored here, in the database, and every read path checks it in SQL (see server/mappers.ts).
 */
export const PUT = route({ rateLimit: { key: "identity", limit: 20, windowSec: 3600 } }, async ({ req, viewer }) => {
  const p = await body(req, identityReveal);
  // One statement: the details and the status change land together or not at all.
  await q(
    `update profiles set revealed_name = $2, revealed_role = $3, bio = $4, identity_mode = 'revealer', revealed_at = now() where user_id = $1`,
    [viewer.id, p.name, p.role, p.description],
  );
  return getMe({ ...viewer, identityMode: "revealer" });
});

export const DELETE = route({ rateLimit: { key: "identity", limit: 20, windowSec: 3600 } }, async ({ viewer }) => {
  // Stored details stay private to the owner (prefilled if they reveal again); nobody else can read them.
  await q(`update profiles set identity_mode = 'saver', revealed_at = null where user_id = $1`, [viewer.id]);
  return getMe({ ...viewer, identityMode: "saver" });
});
