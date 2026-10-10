import "server-only";
import { one, tx } from "../db";
import { drainStorageQueue } from "../storage";

/**
 * Deletes a post, its media rows and everything attached to it (discussion, solutions,
 * interactions, ranking data) via FK cascades. Storage keys are queued in the same
 * transaction, then removed from Neon Object Storage.
 */
export async function deletePost(postId: string, reason: string) {
  await tx([
    {
      text: `insert into storage_gc (object_key, bucket, reason) select object_key, bucket, $2 from media where post_id = $1 on conflict do nothing`,
      params: [postId, reason],
    },
    { text: `delete from posts where id = $1`, params: [postId] },
  ]);
  await drainStorageQueue().catch(() => {});
}

/**
 * Deletes an account completely. Removing the Neon Auth user cascades to its sessions and
 * linked accounts, and through profiles to every RUHIZ row the person owns: posts, media rows,
 * contributions, solutions, help offers, supports, saves, messages, notifications, interest
 * scores and interaction events. Replies by other people to this user's comments are kept
 * (their parent reference is cleared). Admin audit entries are kept on purpose.
 */
export async function deleteAccount(userId: string, reason: string) {
  const exists = await one(`select 1 from neon_auth."user" where id = $1`, [userId]);
  if (!exists) return false;
  await tx([
    {
      text: `insert into storage_gc (object_key, bucket, reason) select object_key, bucket, $2 from media where owner_id = $1 on conflict do nothing`,
      params: [userId, reason],
    },
    { text: `delete from neon_auth."user" where id = $1`, params: [userId] },
  ]);
  await drainStorageQueue().catch(() => {});
  return true;
}
