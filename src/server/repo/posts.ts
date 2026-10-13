import "server-only";
import type { CategoryId, FeedTab, Post, SolutionStage } from "@/lib/types";
import { q } from "../db";
import { ms, msOrNull, toUser, userCols } from "../mappers";
import type { Viewer } from "../session";

const POST_SELECT = `
  select p.id, p.author_id, p.kind, p.intent, p.category_id, p.title, p.body, p.identity_mode, p.location,
         p.status, p.outcome, p.addresses_post_id, ap.title as addresses_title, p.created_at, p.edited_at,
         ${userCols("pr", "a_", "p.identity_mode")},
         st.supports, st.cares, st.discussions, st.shares, st.help_offers,
         exists(select 1 from post_supports x where x.post_id = p.id and x.user_id = $1) as v_supported,
         exists(select 1 from post_cares x where x.post_id = p.id and x.user_id = $1) as v_cared,
         exists(select 1 from post_saves x where x.post_id = p.id and x.user_id = $1) as v_saved,
         ts.id as ts_id, ts.title as ts_title, ts.stage as ts_stage, ts.funding_needed as ts_needed, ts.raised as ts_raised
    from posts p
    join profiles pr on pr.user_id = p.author_id
    join post_stats st on st.post_id = p.id
    left join posts ap on ap.id = p.addresses_post_id
    left join lateral (
      select s.id, s.title, s.stage, s.funding_needed,
             coalesce((select sum(amount) from solution_pledges sp where sp.solution_id = s.id), 0) as raised
        from solutions s
       where s.problem_id = p.id
       order by (select count(*) from solution_supports ss where ss.solution_id = s.id) desc, s.created_at
       limit 1
    ) ts on true`;

/** Loads posts by id for a viewer, preserving the given order. */
export async function getPostsByIds(viewer: Viewer, ids: string[]): Promise<Post[]> {
  if (!ids.length) return [];
  const rows = await q(`${POST_SELECT} where p.id = any($2::uuid[])`, [viewer.id, ids]);
  const media = await q<{ id: string; post_id: string; kind: "image" | "video"; alt: string; width: number | null; height: number | null }>(
    `select id, post_id, kind, alt, width, height from media where post_id = any($1::uuid[]) and status = 'ready' order by position, created_at`,
    [ids],
  );
  const helpers = await q<{ post_id: string; people: { code: string; avatar: string | null }[] }>(
    `select post_id, (json_agg(json_build_object('code', code, 'avatar', avatar_media_id)))::jsonb as people from (
       select distinct on (h.post_id, pr.user_id) h.post_id, pr.code, pr.avatar_media_id
         from help_offers h join profiles pr on pr.user_id = h.user_id where h.post_id = any($1::uuid[])
     ) t group by post_id`,
    [ids],
  );
  const byPost = new Map<string, Post["media"]>();
  for (const m of media) byPost.set(m.post_id, [...(byPost.get(m.post_id) ?? []), { id: m.id, type: m.kind, url: `/api/media/${m.id}`, alt: m.alt, width: m.width, height: m.height }]);
  const helperMap = new Map(
    helpers.map((h) => [h.post_id, h.people.slice(0, 4).map((p) => ({ code: p.code.trim(), avatarUrl: p.avatar ? `/api/media/${p.avatar}` : null }))]),
  );

  const posts = new Map<string, Post>();
  for (const r of rows) {
    const id = String(r.id);
    posts.set(id, {
      id,
      author: toUser(r, "a_"),
      kind: r.kind as Post["kind"],
      intent: r.intent as Post["intent"],
      category: r.category_id as CategoryId,
      title: (r.title as string) ?? null,
      text: String(r.body),
      media: byPost.get(id) ?? [],
      createdAt: ms(r.created_at),
      editedAt: msOrNull(r.edited_at),
      identity: r.identity_mode as Post["identity"],
      location: String(r.location ?? ""),
      status: (r.status as Post["status"]) ?? null,
      outcome: (r.outcome as string) ?? null,
      addresses: r.addresses_post_id ? { id: String(r.addresses_post_id), title: String(r.addresses_title ?? "a problem") } : null,
      topSolution: r.ts_id
        ? { id: String(r.ts_id), title: String(r.ts_title), stage: r.ts_stage as SolutionStage, fundingNeeded: Number(r.ts_needed), fundingRaised: Number(r.ts_raised) }
        : null,
      counts: {
        supports: Number(r.supports),
        cares: Number(r.cares),
        discussions: Number(r.discussions),
        shares: Number(r.shares),
        helpers: Number(r.help_offers),
      },
      helpers: helperMap.get(id) ?? [],
      viewer: {
        supported: Boolean(r.v_supported),
        cared: Boolean(r.v_cared),
        saved: Boolean(r.v_saved),
        isOwner: r.author_id === viewer.id,
        canModerate: viewer.isAdmin,
      },
    });
  }
  return ids.map((id) => posts.get(id)).filter((p): p is Post => Boolean(p));
}

/* ───────────────────────── Feed algorithm ─────────────────────────
 * Deterministic, database-backed ranking. See docs/feed-algorithm-and-support-roles.md.
 * Each tab returns candidate ids + scores from SQL; For You then applies a diversity pass.
 */

const PAGE = 20;
const EXCLUDE_HIDDEN = `not exists (select 1 from post_hidden h where h.user_id = $1 and h.post_id = p.id)`;
const NOT_EXCLUDED = `not (p.id = any($3::uuid[]))`;
const IN_CATS = `($2::text[] is null or p.category_id = any($2::text[]))`;
const AGE_H = `(extract(epoch from now() - p.created_at) / 3600.0)`;
const VELOCITY = `least(ln(1 + (st.supports + st.cares + st.shares + 3 * st.discussions) / (${AGE_H} + 2)) / ln(11), 1)`;
const DEPTH = `least(st.contribution_types / 6.0, 1)`;

interface Candidate {
  id: string;
  category_id: string;
  kind: string;
  score: number;
}

export async function rankFeed(viewer: Viewer, tab: FeedTab, categories: CategoryId[] | null, exclude: string[]) {
  const params: unknown[] = [viewer.id, categories?.length ? categories : null, exclude];
  let rows: Candidate[] = [];

  if (tab === "latest") {
    rows = await q<Candidate>(
      `select p.id, p.category_id, p.kind, 0 as score from posts p
        where ${EXCLUDE_HIDDEN} and ${NOT_EXCLUDED} and ${IN_CATS}
        order by p.created_at desc, p.id desc limit ${PAGE + 1}`,
      params,
    );
  } else if (tab === "trending") {
    // Discussion weighted highest; problems decay slower than other posts.
    rows = await q<Candidate>(
      `select p.id, p.category_id, p.kind,
              (st.discussions * 4 + st.supports + st.shares * 2 + st.cares * 0.5)
                / power(${AGE_H} + 2, case when p.intent = 'problem' then 0.6 else 0.8 end) as score
         from posts p join post_stats st on st.post_id = p.id
        where p.created_at > now() - interval '14 days' and ${EXCLUDE_HIDDEN} and ${NOT_EXCLUDED} and ${IN_CATS}
        order by score desc, p.created_at desc limit ${PAGE + 1}`,
      params,
    );
  } else if (tab === "nearby") {
    if (!viewer.location.trim()) return { ids: [], hasMore: false, needsLocation: true };
    params.push(viewer.location);
    rows = await q<Candidate>(
      `select p.id, p.category_id, p.kind,
              (0.5 * ${VELOCITY} + 0.5 * ${DEPTH} + 0.2 * exp(-${AGE_H} / 72.0))
                * case when p.intent = 'problem' then 1.25 else 1 end as score
         from posts p join post_stats st on st.post_id = p.id
        where lower(btrim(p.location)) = lower(btrim($4)) and p.created_at > now() - interval '60 days'
          and ${EXCLUDE_HIDDEN} and ${NOT_EXCLUDED} and ${IN_CATS}
        order by score desc, p.created_at desc limit ${PAGE + 1}`,
      params,
    );
  } else if (tab === "unsolved") {
    // Urgency: neglected problems rank higher, well-staffed ones lower.
    rows = await q<Candidate>(
      `select p.id, p.category_id, p.kind,
              0.35 * (1 - least(st.help_offers / 3.0, 1))
            + 0.25 * least(ln(1 + st.supports) / ln(101), 1)
            + 0.20 * least(extract(epoch from now() - st.last_status_change_at) / 86400.0 / 14.0, 1)
            + 0.20 * ${DEPTH} as score
         from posts p join post_stats st on st.post_id = p.id
        where p.intent = 'problem' and p.status <> 'solved' and ${EXCLUDE_HIDDEN} and ${NOT_EXCLUDED} and ${IN_CATS}
        order by score desc, p.created_at desc limit ${PAGE + 1}`,
      params,
    );
  } else {
    // For You: personal interests + people you support + healthy discussion + need + recency − repetition.
    const candidates = await q<Candidate & { created_at: string; author_id: string }>(
      `with interest as (
         select category_id, score * power(0.95, extract(epoch from now() - updated_at) / 604800.0) as s
           from user_category_interest where user_id = $1),
       imax as (select greatest(coalesce(max(s), 0), 1e-9) as m from interest),
       kinds as (
         select kind, score * power(0.95, extract(epoch from now() - updated_at) / 604800.0) as s
           from user_kind_preference where user_id = $1),
       kmax as (select greatest(coalesce(max(s), 0), 1e-9) as m from kinds)
       select p.id, p.category_id, p.kind, p.created_at, p.author_id,
              0.30 * coalesce(i.s / imax.m, 0)
            + 0.20 * ((case when exists (select 1 from user_supports u where u.supporter_id = $1 and u.supported_id = p.author_id) then 1 else 0 end)
                    + (case when exists (select 1 from user_supports u where u.supporter_id = p.author_id and u.supported_id = $1) then 0.5 else 0 end)) / 1.5
            + 0.15 * ${VELOCITY}
            + 0.15 * ${DEPTH}
            + 0.10 * (case when p.intent = 'problem' and p.status <> 'solved' then 1 - least(st.help_offers / 3.0, 1) else 0 end)
            + 0.10 * exp(-${AGE_H} / 72.0)
            + 0.05 * coalesce(k.s / kmax.m, 0)
            - 0.20 * (case
                when imp.impressions is null then 0
                when exists (select 1 from post_supports x where x.post_id = p.id and x.user_id = $1)
                  or exists (select 1 from post_cares x where x.post_id = p.id and x.user_id = $1)
                  or exists (select 1 from post_saves x where x.post_id = p.id and x.user_id = $1)
                  or exists (select 1 from contributions x where x.post_id = p.id and x.author_id = $1) then 0
                else least(greatest(imp.impressions - 1, 0) / 3.0, 1) end)
            + (case when p.author_id = $1 and p.created_at > now() - interval '10 minutes' then 10 else 0 end) as score
         from posts p
         join post_stats st on st.post_id = p.id
         cross join imax cross join kmax
         left join interest i on i.category_id = p.category_id
         left join kinds k on k.kind = p.kind
         left join post_impressions imp on imp.user_id = $1 and imp.post_id = p.id
        where p.created_at > now() - interval '60 days' and ${EXCLUDE_HIDDEN} and ${NOT_EXCLUDED} and ${IN_CATS}
        order by score desc, p.created_at desc, p.id
        limit 200`,
      params,
    );
    rows = diversify(candidates).slice(0, PAGE + 1);
  }

  const hasMore = rows.length > PAGE;
  const ids = rows.slice(0, PAGE).map((r) => String(r.id));
  if (ids.length) {
    q(
      `insert into post_impressions (user_id, post_id) select $1, unnest($2::uuid[])
       on conflict (user_id, post_id) do update set impressions = post_impressions.impressions + 1, last_seen_at = now()`,
      [viewer.id, ids],
    ).catch(() => {});
  }
  return { ids, hasMore, needsLocation: false };
}

/** Caps any category at 4 of every 10 cards and avoids 3 of the same media kind in a row. Deterministic. */
function diversify<T extends Candidate>(list: T[]): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (pool.length) {
    const recent = out.slice(-9);
    const lastKinds = out.slice(-2).map((x) => x.kind);
    const ok = (c: T) => recent.filter((r) => r.category_id === c.category_id).length < 4 && !(lastKinds.length === 2 && lastKinds.every((k) => k === c.kind));
    let idx = pool.findIndex(ok);
    if (idx < 0) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export async function recordEvent(userId: string, postId: string, event: string, weight: number) {
  await q(`select ruhiz_record_event($1, $2, $3, $4)`, [userId, postId, event, weight]);
}
