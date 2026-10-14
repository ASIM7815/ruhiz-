import { route } from "@/server/http";
import { q } from "@/server/db";
import { itemMasked, toMember, userCols } from "@/server/mappers";

/** Right-hand panel: trending topics, suggested people, popular posts and nearby problems. Real data only. */
export const GET = route({}, async ({ viewer }) => {
  const topics = await q<{ id: string; label: string; activity: number; posts: number }>(
    `select c.id, c.label,
            (select count(*)::int from posts p where p.category_id = c.id and p.created_at > now() - interval '7 days')
          + (select count(*)::int from contributions x join posts p on p.id = x.post_id where p.category_id = c.id and x.created_at > now() - interval '7 days') as activity,
            (select count(*)::int from posts p where p.category_id = c.id) as posts
       from categories c order by activity desc, posts desc, c.sort_order limit 5`,
  );

  // People who share your interests, are active, and you don't support yet.
  const suggested = await q(
    `select ${userCols("p", "u_")},
            coalesce((select sum(i.score) from user_category_interest i join user_category_interest mine
                       on mine.category_id = i.category_id and mine.user_id = $1 where i.user_id = p.user_id), 0) as overlap,
            (select count(*) from posts where author_id = p.user_id) + (select count(*) from contributions where author_id = p.user_id) as activity
       from profiles p
      where p.user_id <> $1
        and not exists (select 1 from user_supports s where s.supporter_id = $1 and s.supported_id = p.user_id)
        and coalesce((p.settings->>'allowCodeSearch')::boolean, true)
      order by overlap desc, activity desc, p.last_seen_at desc
      limit 7`,
    [viewer.id],
  );

  const popular = await q<{ id: string; title: string | null; body: string; code: string | null; supports: number; discussions: number; media_id: string | null }>(
    `select p.id, p.title, left(p.body, 120) as body, case when ${itemMasked("pr", "p.identity_mode")} then null else pr.code end as code, st.supports, st.discussions,
            (select m.id from media m where m.post_id = p.id and m.status = 'ready' and m.kind = 'image' order by m.position limit 1) as media_id
       from posts p join post_stats st on st.post_id = p.id join profiles pr on pr.user_id = p.author_id
      where p.created_at > now() - interval '30 days' and (st.supports + st.discussions + st.cares) > 0
        and not exists (select 1 from post_hidden h where h.user_id = $1 and h.post_id = p.id)
      order by (st.discussions * 4 + st.supports + st.shares * 2 + st.cares * 0.5) / power(extract(epoch from now() - p.created_at) / 3600.0 + 2, 0.8) desc
      limit 4`,
    [viewer.id],
  );

  const nearby = viewer.location.trim()
    ? await q<{ id: string; title: string | null; body: string; status: string }>(
        `select id, title, left(body, 120) as body, status from posts
          where intent = 'problem' and status <> 'solved' and lower(btrim(location)) = lower(btrim($1))
          order by created_at desc limit 3`,
        [viewer.location],
      )
    : [];

  return {
    topics,
    suggested: suggested.map((r) => toMember(r, "u_")),
    popular: popular.map((p) => ({
      id: p.id,
      title: p.title ?? p.body,
      authorCode: p.code ? p.code.trim() : null,
      supports: Number(p.supports),
      discussions: Number(p.discussions),
      thumbUrl: p.media_id ? `/api/media/${p.media_id}` : null,
    })),
    nearby: nearby.map((p) => ({ id: p.id, title: p.title ?? p.body, status: p.status })),
    location: viewer.location,
  };
});
