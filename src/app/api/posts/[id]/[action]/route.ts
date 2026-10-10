import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { notFound } from "@/server/errors";
import { recordEvent } from "@/server/repo/posts";
import { notify } from "@/server/repo/notify";

/**
 * Toggle interactions: POST adds, DELETE removes. The acting user is always the session user.
 *   support · care · save · hide
 */
const TABLES = { support: "post_supports", care: "post_cares", save: "post_saves", hide: "post_hidden" } as const;
const WEIGHT = { support: 2, care: 1, save: 2, hide: -2 } as const;
type Action = keyof typeof TABLES;

async function resolve(params: { id: string; action: string }) {
  const id = parseId(params.id);
  if (!(params.action in TABLES)) throw notFound();
  const post = await one<{ author_id: string }>(`select author_id from posts where id = $1`, [id]);
  if (!post) throw notFound("This post isn't available.");
  return { id, action: params.action as Action, authorId: post.author_id };
}

async function counts(id: string) {
  return one<{ supports: number; cares: number; saves: number }>(`select supports, cares, saves from post_stats where post_id = $1`, [id]);
}

export const POST = route<{ id: string; action: string }>({}, async ({ viewer, params }) => {
  const { id, action, authorId } = await resolve(params);
  const rows = await q(`insert into ${TABLES[action]} (post_id, user_id) values ($1, $2) on conflict do nothing returning 1`, [id, viewer.id]);
  if (rows.length) {
    await recordEvent(viewer.id, id, action === "hide" ? "unsave" : action, WEIGHT[action]);
    if (action === "support") await notify(authorId, viewer.id, "support", { postId: id });
  }
  return { on: true, ...(await counts(id)) };
});

export const DELETE = route<{ id: string; action: string }>({}, async ({ viewer, params }) => {
  const { id, action } = await resolve(params);
  const rows = await q(`delete from ${TABLES[action]} where post_id = $1 and user_id = $2 returning 1`, [id, viewer.id]);
  if (rows.length && action !== "hide") await recordEvent(viewer.id, id, `un${action}`, -WEIGHT[action]);
  return { on: false, ...(await counts(id)) };
});
