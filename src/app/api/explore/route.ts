import { route } from "@/server/http";
import { q } from "@/server/db";
import { CATEGORY } from "@/server/schemas";
import { getPostsByIds } from "@/server/repo/posts";
import { listSolutions } from "@/server/repo/solutions";

/** Discovery of problems by category. All numbers are live counts. */
export const GET = route({}, async ({ req, viewer }) => {
  const sp = req.nextUrl.searchParams;
  const cat = CATEGORY.safeParse(sp.get("category")).success ? sp.get("category") : null;
  const tab = sp.get("tab") ?? "trending";

  const [stats] = await q<Record<string, number>>(
    `select (select count(*)::int from posts where intent = 'problem' and status <> 'solved') as open_problems,
            (select count(*)::int from solutions) as solutions,
            (select count(*)::int from help_offers) as help_offers,
            (select count(*)::int from posts where intent = 'problem' and status = 'solved') as solved`,
  );
  const categories = await q<{ id: string; posts: number; open: number }>(
    `select c.id, count(p.id)::int as posts, count(p.id) filter (where p.intent = 'problem' and p.status <> 'solved')::int as open
       from categories c left join posts p on p.category_id = c.id group by c.id, c.sort_order order by c.sort_order`,
  );

  let ids: string[] = [];
  let solutions: Awaited<ReturnType<typeof listSolutions>> = [];
  let recentCounts: Record<string, number> = {};
  if (tab === "trending" || tab === "recent") {
    const rows = await q<{ id: string }>(
      tab === "trending"
        ? `select p.id from posts p join post_stats st on st.post_id = p.id
            where p.intent = 'problem' and ($1::text is null or p.category_id = $1)
            order by (st.discussions * 3 + st.supports) / power(extract(epoch from now() - p.created_at) / 3600.0 + 2, 0.6) desc, p.created_at desc limit 30`
        : `select id from posts p where intent = 'problem' and ($1::text is null or category_id = $1) order by created_at desc limit 30`,
      [cat],
    );
    ids = rows.map((r) => r.id);
  } else if (tab === "discussions") {
    const rows = await q<{ id: string; n: number }>(
      `select p.id, count(c.id)::int as n from posts p join contributions c on c.post_id = p.id
        where c.created_at > now() - interval '48 hours' and ($1::text is null or p.category_id = $1)
        group by p.id order by n desc, max(c.created_at) desc limit 30`,
      [cat],
    );
    ids = rows.map((r) => r.id);
    recentCounts = Object.fromEntries(rows.map((r) => [r.id, r.n]));
  } else if (tab === "solutions") {
    solutions = await listSolutions(viewer, "popular", cat, 30);
  }

  return {
    stats,
    categories,
    posts: await getPostsByIds(viewer, ids),
    solutions,
    recentCounts,
  };
});
