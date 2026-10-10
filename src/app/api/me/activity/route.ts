import { route } from "@/server/http";
import { q } from "@/server/db";
import { getPostsByIds } from "@/server/repo/posts";
import { listContributionsByAuthor, listHelpByUser } from "@/server/repo/discussion";
import { listSolutions } from "@/server/repo/solutions";

/** My Contributions: everything the signed-in user has brought to RUHIZ. */
export const GET = route({}, async ({ viewer }) => {
  const rows = await q<{ id: string }>(`select id from posts where author_id = $1 order by created_at desc limit 100`, [viewer.id]);
  const posts = await getPostsByIds(viewer, rows.map((r) => r.id));
  return {
    problems: posts.filter((p) => p.intent === "problem"),
    posts: posts.filter((p) => p.intent !== "problem"),
    solutions: await listSolutions(viewer, "contributor", viewer.id, 100),
    contributions: await listContributionsByAuthor(viewer, viewer.id, 100),
    help: await listHelpByUser(viewer, viewer.id),
  };
});
