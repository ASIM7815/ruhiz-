import { z } from "zod";
import { body, parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { forbidden, notFound } from "@/server/errors";
import { editPost } from "@/server/schemas";
import { audit, requireAdmin } from "@/server/session";
import { getPostsByIds, recordEvent } from "@/server/repo/posts";
import { deletePost } from "@/server/repo/deletion";
import { ms } from "@/server/mappers";

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const [post] = await getPostsByIds(viewer, [id]);
  if (!post) throw notFound("This post isn't available.");
  const updates = await q<{ status: string; note: string; created_at: string; code: string | null }>(
    `select u.status, u.note, u.created_at, pr.code from post_lifecycle_updates u left join profiles pr on pr.user_id = u.actor_id
      where u.post_id = $1 order by u.created_at`,
    [id],
  );
  recordEvent(viewer.id, id, "view", 0.25).catch(() => {});
  return {
    ...post,
    updates: updates.map((u) => ({ status: u.status, text: u.note, at: ms(u.created_at), actor: u.code?.trim() ?? null })),
  };
});

/** Authors may edit the title, text and category of their own posts. */
export const PATCH = route<{ id: string }>({}, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const p = await body(req, editPost);
  const post = await one<{ author_id: string; intent: string }>(`select author_id, intent from posts where id = $1`, [id]);
  if (!post) throw notFound();
  if (post.author_id !== viewer.id) throw forbidden("You can only edit your own posts.");
  if (p.title !== undefined && (post.intent === "problem" || post.intent === "solution") && (!p.title || p.title.length < 6))
    throw forbidden("Problems and solutions need a title of at least 6 characters.");
  await q(
    `update posts set title = case when $2 then $3 else title end, body = coalesce($4, body), category_id = coalesce($5, category_id), edited_at = now() where id = $1`,
    [id, p.title !== undefined, p.title || null, p.text ?? null, p.category ?? null],
  );
  const [updated] = await getPostsByIds(viewer, [id]);
  return updated;
});

/** Authors delete their own posts; the two administrators may delete any post. */
export const DELETE = route<{ id: string }>({}, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const post = await one<{ author_id: string; title: string | null }>(`select author_id, title from posts where id = $1`, [id]);
  if (!post) throw notFound();
  const own = post.author_id === viewer.id;
  if (!own && !viewer.isAdmin) throw forbidden("You can only delete your own posts.");
  if (!own) {
    // Moderator path: admin status is re-verified against the database.
    const admin = await requireAdmin();
    const reason = await req
      .json()
      .then((b) => z.object({ reason: z.string().trim().max(300).optional() }).parse(b ?? {}).reason)
      .catch(() => undefined);
    await audit(admin, "delete_post", "post", id, { authorId: post.author_id, title: post.title, reason: reason ?? null });
  }
  await deletePost(id, own ? "deleted by author" : "removed by moderator");
  return { ok: true };
});
