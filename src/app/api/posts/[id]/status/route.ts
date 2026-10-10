import { body, parseId, route } from "@/server/http";
import { one, tx } from "@/server/db";
import { badRequest, forbidden, notFound } from "@/server/errors";
import { statusChange } from "@/server/schemas";
import { audit } from "@/server/session";
import { getPostsByIds } from "@/server/repo/posts";
import { notify } from "@/server/repo/notify";
import { q } from "@/server/db";

const LABEL: Record<string, string> = { unsolved: "Unsolved", discussion: "In Discussion", solutions: "Solutions Proposed", implementation: "Implementing", solved: "Solved" };

/** Only the problem's author (or an administrator) can change its lifecycle status. */
export const POST = route<{ id: string }>({}, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const p = await body(req, statusChange);
  const post = await one<{ author_id: string; status: string | null }>(`select author_id, status from posts where id = $1 and intent = 'problem'`, [id]);
  if (!post) throw notFound("Problem not found.");
  if (post.author_id !== viewer.id && !viewer.isAdmin) throw forbidden("Only the person who raised this problem can change its status.");
  if (post.status === p.status) throw badRequest("That's already the current status.");

  const note = p.note || `#${viewer.code} moved this to ${LABEL[p.status]}.`;
  await tx([
    { text: `update posts set status = $2, outcome = case when $2 = 'solved' then $3 else outcome end where id = $1`, params: [id, p.status, p.outcome || null] },
    { text: `insert into post_lifecycle_updates (post_id, status, note, actor_id) values ($1, $2, $3, $4)`, params: [id, p.status, note, viewer.id] },
  ]);
  if (post.author_id !== viewer.id) await audit(viewer, "change_problem_status", "post", id, { from: post.status, to: p.status });

  // Let supporters and helpers know the problem moved.
  const watchers = await q<{ user_id: string }>(
    `select user_id from post_supports where post_id = $1 union select user_id from help_offers where post_id = $1 limit 200`,
    [id],
  );
  for (const w of watchers) await notify(w.user_id, viewer.id, "status", { postId: id });

  const [updated] = await getPostsByIds(viewer, [id]);
  return updated;
});
