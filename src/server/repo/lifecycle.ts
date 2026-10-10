import "server-only";
import { q } from "../db";

const ORDER = ["unsolved", "discussion", "solutions", "implementation", "solved"];

/** Moves a problem forward (never backward) as a system update. */
export async function advanceProblem(postId: string, to: string, note: string) {
  const rows = await q<{ id: string }>(
    `update posts set status = $2 where id = $1 and intent = 'problem'
        and array_position($3::text[], status) < array_position($3::text[], $2::text) returning id`,
    [postId, to, ORDER],
  );
  if (rows.length) await q(`insert into post_lifecycle_updates (post_id, status, note) values ($1, $2, $3)`, [postId, to, note]);
  return rows.length > 0;
}
