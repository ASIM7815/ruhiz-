import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { newHelp } from "@/server/schemas";
import { listHelp } from "@/server/repo/discussion";
import { recordEvent } from "@/server/repo/posts";
import { notify } from "@/server/repo/notify";

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => listHelp(viewer, parseId(params.id)));

/** "I Can Help" — offered by the signed-in user on an open problem. */
export const POST = route<{ id: string }>({ rateLimit: { key: "help", limit: 40, windowSec: 3600 } }, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const p = await body(req, newHelp);
  const post = await one<{ author_id: string; status: string | null }>(`select author_id, status from posts where id = $1 and intent = 'problem'`, [id]);
  if (!post) throw notFound("Problem not found.");
  if (post.status === "solved") throw badRequest("This problem is already solved.");
  const [row] = await q<{ id: string }>(
    `insert into help_offers (post_id, user_id, type, note, availability) values ($1, $2, $3, $4, $5)
     on conflict (post_id, user_id, type) do update set note = excluded.note, availability = excluded.availability returning id`,
    [id, viewer.id, p.type, p.note, p.availability],
  );
  await recordEvent(viewer.id, id, "help", 2);
  await notify(post.author_id, viewer.id, "help", { postId: id });
  const offers = await listHelp(viewer, id);
  return offers.find((o) => o.id === row.id);
});
