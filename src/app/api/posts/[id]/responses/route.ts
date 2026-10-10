import { parseId, route } from "@/server/http";
import { q } from "@/server/db";
import { getPostsByIds } from "@/server/repo/posts";

/** Posts that respond to a problem (e.g. solution write-ups and field updates). */
export const GET = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const rows = await q<{ id: string }>(`select id from posts where addresses_post_id = $1 order by created_at desc limit 50`, [id]);
  return getPostsByIds(viewer, rows.map((r) => r.id));
});
