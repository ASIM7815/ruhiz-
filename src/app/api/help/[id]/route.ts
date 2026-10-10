import { parseId, route } from "@/server/http";
import { q } from "@/server/db";
import { notFound } from "@/server/errors";

/** Withdraw your own offer of help. */
export const DELETE = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const rows = await q(`delete from help_offers where id = $1 and user_id = $2 returning 1`, [id, viewer.id]);
  if (!rows.length) throw notFound();
  return { ok: true };
});
