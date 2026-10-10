import { route } from "@/server/http";
import { q } from "@/server/db";
import { getPostsByIds } from "@/server/repo/posts";
import { getSolution } from "@/server/repo/solutions";

/** The viewer's own saved posts, problems and Solution Cards, newest first. */
export const GET = route({}, async ({ viewer }) => {
  const rows = await q<{ kind: "post" | "solution"; id: string }>(
    `select * from (
       select 'post' as kind, post_id as id, created_at from post_saves where user_id = $1
       union all
       select 'solution', solution_id, created_at from solution_saves where user_id = $1
     ) t order by created_at desc limit 200`,
    [viewer.id],
  );
  const posts = await getPostsByIds(viewer, rows.filter((r) => r.kind === "post").map((r) => r.id));
  const byId = new Map(posts.map((p) => [p.id, p]));
  const items = [];
  for (const r of rows) {
    if (r.kind === "post") {
      const p = byId.get(r.id);
      if (p) items.push({ kind: p.intent === "problem" ? "problem" : "post", post: p });
    } else {
      const s = await getSolution(viewer, r.id);
      if (s) items.push({ kind: "solution", solution: s });
    }
  }
  return items;
});
