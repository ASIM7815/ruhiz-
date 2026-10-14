import { body, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest } from "@/server/errors";
import { newPost } from "@/server/schemas";
import { getPostsByIds, recordEvent } from "@/server/repo/posts";
import { notify } from "@/server/repo/notify";

export const POST = route({ rateLimit: { key: "post", limit: 30, windowSec: 3600 } }, async ({ req, viewer }) => {
  const p = await body(req, newPost);
  if (p.identity === "revealer" && viewer.identityMode !== "revealer")
    throw badRequest("Reveal your identity in Settings before posting as Identity Revealer.");

  if (p.addresses) {
    const target = await one<{ author_id: string }>(`select author_id from posts where id = $1 and intent = 'problem'`, [p.addresses]);
    if (!target) throw badRequest("The problem you're responding to no longer exists.");
  }

  // Media must be the caller's own, finished, unattached uploads of the right kind.
  if (p.mediaIds.length) {
    const wanted = p.kind === "video" ? "video" : "image";
    const rows = await q<{ id: string }>(
      `select id from media where id = any($1::uuid[]) and owner_id = $2 and purpose = 'post' and status = 'ready' and post_id is null and kind = $3`,
      [p.mediaIds, viewer.id, wanted],
    );
    if (rows.length !== new Set(p.mediaIds).size) throw badRequest("One or more uploads are missing or still processing.");
  }

  const isProblem = p.intent === "problem";
  const [row] = await q<{ id: string }>(
    `insert into posts (author_id, kind, intent, category_id, title, body, identity_mode, location, status, addresses_post_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [viewer.id, p.kind, p.intent, p.category, p.title || null, p.text, p.identity, p.tagArea ? viewer.location : "", isProblem ? "unsolved" : null, p.addresses ?? null],
  );
  const id = row.id;

  for (const [i, mid] of p.mediaIds.entries()) await q(`update media set post_id = $1, position = $2 where id = $3`, [id, i, mid]);
  if (isProblem) await q(`insert into post_lifecycle_updates (post_id, status, note, actor_id) values ($1, 'unsolved', $2, $3)`, [id, "Problem raised.", viewer.id]);
  await recordEvent(viewer.id, id, "author", 3);

  if (p.addresses) {
    const target = await one<{ author_id: string }>(`select author_id from posts where id = $1`, [p.addresses]);
    await notify(target?.author_id, viewer.id, "response", { postId: p.addresses });
  }
  const [post] = await getPostsByIds(viewer, [id]);
  return post;
});
