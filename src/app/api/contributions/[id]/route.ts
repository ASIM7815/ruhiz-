import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { forbidden, notFound } from "@/server/errors";
import { audit, requireAdmin } from "@/server/session";

/** Authors delete their own contributions; administrators may remove any. */
export const DELETE = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const c = await one<{ author_id: string; body: string }>(`select author_id, body from contributions where id = $1`, [id]);
  if (!c) throw notFound();
  const own = c.author_id === viewer.id;
  if (!own && !viewer.isAdmin) throw forbidden("You can only delete your own contributions.");
  if (!own) {
    const admin = await requireAdmin();
    await audit(admin, "delete_contribution", "contribution", id, { authorId: c.author_id, excerpt: c.body.slice(0, 120) });
  }
  await q(`delete from contributions where id = $1`, [id]);
  return { ok: true };
});
