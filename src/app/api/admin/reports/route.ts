import { route } from "@/server/http";
import { q } from "@/server/db";
import { ms } from "@/server/mappers";

export const GET = route({ access: "admin" }, async ({ req }) => {
  const status = req.nextUrl.searchParams.get("status") === "closed" ? "closed" : "open";
  const rows = await q(
    `select r.id, r.reason, r.details, r.status, r.created_at, r.post_id, r.contribution_id, r.solution_id,
            rp.code as reporter_code, ru.code as reported_code,
            coalesce(p.title, left(p.body, 140)) as post_excerpt, pa.code as post_author,
            left(c.body, 140) as contribution_excerpt, ca.code as contribution_author, c.post_id as contribution_post_id, c.solution_id as contribution_solution_id,
            s.title as solution_title, sa.code as solution_author,
            (select count(*)::int from reports r2 where r2.status = 'open'
               and (r2.post_id = r.post_id or r2.contribution_id = r.contribution_id or r2.solution_id = r.solution_id or r2.reported_user_id = r.reported_user_id)) as open_count
       from reports r
       join profiles rp on rp.user_id = r.reporter_id
       left join profiles ru on ru.user_id = r.reported_user_id
       left join posts p on p.id = r.post_id left join profiles pa on pa.user_id = p.author_id
       left join contributions c on c.id = r.contribution_id left join profiles ca on ca.user_id = c.author_id
       left join solutions s on s.id = r.solution_id left join profiles sa on sa.user_id = s.author_id
      where ($1 = 'open' and r.status = 'open') or ($1 = 'closed' and r.status <> 'open')
      order by r.created_at desc limit 200`,
    [status],
  );
  return rows.map((r) => {
    const target = r.post_id
      ? { kind: "post", id: r.post_id, excerpt: r.post_excerpt, author: String(r.post_author).trim(), href: `/post/${r.post_id}` }
      : r.contribution_id
        ? { kind: "contribution", id: r.contribution_id, excerpt: r.contribution_excerpt, author: String(r.contribution_author).trim(), href: r.contribution_post_id ? `/post/${r.contribution_post_id}#discussion` : `/solution/${r.contribution_solution_id}#discussion` }
        : r.solution_id
          ? { kind: "solution", id: r.solution_id, excerpt: r.solution_title, author: String(r.solution_author).trim(), href: `/solution/${r.solution_id}` }
          : { kind: "user", id: String(r.reported_code).trim(), excerpt: null, author: String(r.reported_code).trim(), href: `/profile/${String(r.reported_code).trim()}` };
    return {
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: ms(r.created_at),
      reporter: String(r.reporter_code).trim(),
      openCount: Number(r.open_count),
      target,
    };
  });
});
