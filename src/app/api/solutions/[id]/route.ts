import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { forbidden, notFound } from "@/server/errors";
import { audit, requireAdmin } from "@/server/session";
import { getSolution } from "@/server/repo/solutions";

export const GET = route<{ id: string }>({}, async ({ viewer, params }) => {
  const s = await getSolution(viewer, parseId(params.id));
  if (!s) throw notFound("Solution not found.");
  return s;
});

/** Solution authors delete their own cards; administrators may remove any. */
export const DELETE = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const s = await one<{ author_id: string; title: string }>(`select author_id, title from solutions where id = $1`, [id]);
  if (!s) throw notFound();
  if (s.author_id !== viewer.id) {
    if (!viewer.isAdmin) throw forbidden("You can only delete your own Solution Cards.");
    await audit(await requireAdmin(), "delete_solution", "solution", id, { authorId: s.author_id, title: s.title });
  }
  await q(`delete from solutions where id = $1`, [id]);
  return { ok: true };
});
