import "server-only";
import { one, tx } from "../db";
import { drainStorageQueue } from "../storage";

/**
 * Deletes a post, its media rows and everything attached to it (discussion, solutions,
 * interactions, ranking data) via FK cascades. Storage keys are queued in the same
 * transaction, then removed from Neon Object Storage.
 */
export async function deletePost(postId: string, by: { actorId: string; kind: "owner" | "admin"; reason?: string | null }) {
  const gcReason = by.kind === "owner" ? "deleted by author" : "removed by administrator";
  await tx([
    // Audit first (same transaction): who deleted it and in which capacity. No post content is kept.
    {
      text: `insert into post_deletion_log (post_id, author_id, deleted_by, actor_kind, reason, media_count)
             select p.id, p.author_id, $2, $3, $4, (select count(*) from media m where m.post_id = p.id) from posts p where p.id = $1`,
      params: [postId, by.actorId, by.kind, by.reason?.slice(0, 300) ?? null],
    },
    {
      text: `insert into storage_gc (object_key, bucket, reason) select object_key, bucket, $2 from media where post_id = $1 on conflict do nothing`,
      params: [postId, gcReason],
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
