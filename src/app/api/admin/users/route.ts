import { route } from "@/server/http";
import { q } from "@/server/db";
import { accountRevealed, ms } from "@/server/mappers";

/** Admin user lookup by code or email. Emails are visible here only. */
export const GET = route({ access: "admin" }, async ({ req }) => {
  const term = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  const code = term.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = await q(
    `select p.code, case when ${accountRevealed("p")} then p.headline else '' end as headline, p.created_at, p.last_seen_at, u.email,
            exists(select 1 from user_roles r where r.user_id = u.id and r.role = 'admin') and u."emailVerified" as is_admin,
            (select count(*)::int from posts where author_id = p.user_id) as posts,
            (select count(*)::int from contributions where author_id = p.user_id) as contributions,
            (select count(*)::int from reports r where r.status = 'open' and (r.reported_user_id = p.user_id
               or r.post_id in (select id from posts where author_id = p.user_id)
               or r.contribution_id in (select id from contributions where author_id = p.user_id))) as open_reports
       from profiles p join neon_auth."user" u on u.id = p.user_id
      where $1 = '' or (length($2) > 0 and p.code like $2 || '%') or u.email ilike '%' || $1 || '%'
      order by p.created_at desc limit 100`,
    [term, code],
  );
  return rows.map((r) => ({
    code: String(r.code).trim(),
    headline: r.headline,
    email: r.email,
    joinedAt: ms(r.created_at),
    lastSeenAt: ms(r.last_seen_at),
    posts: r.posts,
    contributions: r.contributions,
    openReports: r.open_reports,
    isAdmin: Boolean(r.is_admin),
  }));
});
