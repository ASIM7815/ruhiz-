-- ============================================================================
-- DUEL social feed migration (2026-09-21)
--
-- What this adds, and why:
--
--  1. public.user_keywords
--     A learned interest profile per user. Every like, save, join, check-in,
--     comment, search and view feeds keyword weights (with time decay).
--     This is the "keywords made by user" signal the recommendation and
--     Explore feeds rank against — exactly like an interest graph.
--
--  2. public.checkin_likes / public.checkin_comments
--     Posts (challenge_checkins) are now first-class social objects with
--     their own likes and comments, plus denormalised counters maintained
--     by triggers. RLS: public read, authenticated write, self-only delete.
--
--  3. public.duel_tokenize(text)
--     Pure-SQL tokenizer (lowercase, split, stopwords removed, min length 3).
--
--  4. public.duel_feed(...)
--     The Explore "reels" ranking: public posts scored by
--       34% category affinity  (user_category_affinity)
--       24% keyword overlap    (user_keywords ∩ post keywords)
--       16% creator affinity   (your interactions with the author)
--       12% engagement         (post likes + comments, log scale)
--       14% freshness          (half-life ~72h, reels-style)
--       + stable per-user jitter
--     with diversity caps (≤2 per challenge, ≤3 per category per page).
--     Cold-start users (no signals) fall back to engagement + freshness.
--
--  5. public.duel_trending(p_limit)
--     True global top-N challenges (not limited by the client's page size).
--
--  6. duel_refresh_recommendations is recreated with a keyword component so
--     Home "Recommended for you" also matches keywords the user has built
--     up from likes/searches/posts.
--
-- Idempotent: safe to re-run. Run after 20260920000000_duel_platform.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USER KEYWORDS (interest profile)
-- ----------------------------------------------------------------------------

create table if not exists public.user_keywords (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  keyword    text not null check (char_length(keyword) between 2 and 40),
  weight     double precision not null default 0 check (weight >= 0 and weight <= 40),
  updated_at timestamptz not null default now(),
  primary key (user_id, keyword)
);

create index if not exists idx_user_keywords_user on public.user_keywords (user_id, weight desc);

/**
 * Pure-SQL tokenizer: lowercase, split on non-alphanumerics, drop
 * stopwords and tokens shorter than 3 characters, de-duplicate.
 */
create or replace function public.duel_tokenize(p_text text)
returns text[]
language sql immutable strict as $$
  select array(
    select distinct t
      from (
        select lower(unnest(regexp_split_to_array(coalesce(p_text, ''), '[^a-z0-9]+'))) as t
     ) toks
     where length(t) >= 3
       and t not in (
         -- common English stopwords (kept short on purpose)
         'the','and','for','with','this','that','from','have','has','had','was','were','will','would',
         'your','you','our','their','they','them','then','than','there','here','when','what','where',
         'which','while','about','into','over','under','again','further','once','some','such','only',
         'other','also','very','just','because','though','through','during','before','after','above',
         'below','out','off','up','down','all','any','both','each','few','more','most','no','nor',
         'not','own','same','so','too','against','between','same','day','today','today''s'
       )
     order by t
  );
$$;

/**
 * Bumps keyword weights for a user with recency decay:
 *   new_weight = old_weight * exp(-age_days / 90) + p_weight   (capped at 40)
 * p_extra tokens (e.g. challenge tags) are added verbatim when valid.
 */
create or replace function public.duel_bump_keywords(
  p_user uuid,
  p_text text default null,
  p_extra text[] default null,
  p_weight double precision default 1
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  kw text;
  age_days double precision;
  current_row public.user_keywords%rowtype;
  tokens text[];
begin
  if p_user is null or p_weight <= 0 then return; end if;

  tokens := array_remove(
    array_cat(public.duel_tokenize(p_text), array(select lower(t) from unnest(coalesce(p_extra, array[]::text[])) t where length(lower(t)) between 2 and 40)),
    null
  );
  if coalesce(array_length(tokens, 1), 0) = 0 then return; end if;

  for kw in select distinct t from unnest(tokens) t
  loop
    select * into current_row from public.user_keywords where user_id = p_user and keyword = kw;
    if found then
      age_days := greatest(0, extract(epoch from (now() - current_row.updated_at)) / 86400.0);
      update public.user_keywords
         set weight = least(40, current_row.weight * exp(-age_days / 90.0) + p_weight),
             updated_at = now()
       where user_id = p_user and keyword = kw;
    else
      insert into public.user_keywords (user_id, keyword, weight)
      values (p_user, kw, least(40, p_weight))
      on conflict (user_id, keyword) do update
        set weight = least(40, public.user_keywords.weight + p_weight),
            updated_at = now();
    end if;
  end loop;
end;
$$;

/**
 * Feeds the interest graph from tracked behaviour. Called after activities
 * are inserted (join/like/save/checkin/comment/search/view/complete/...).
 * Search activities carry the raw query; everything else uses the
 * challenge title + tags.
 */
create or replace function public.duel_fn_keyword_behaviour() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ch public.challenges%rowtype;
  w double precision;
begin
  if new.user_id is null then return new; end if;

  w := case new.action
         when 'join' then 6.0
         when 'complete' then 8.0
         when 'save' then 4.0
         when 'like' then 3.0
         when 'comment' then 3.0
         when 'share' then 3.0
         when 'search' then 2.5
         when 'checkin' then 2.0
         when 'create' then 4.0
         when 'view' then 1.0
         else 0.0
       end;
  if w <= 0 then return new; end if;

  if new.action = 'search' and coalesce(new.query, '') <> '' then
    perform public.duel_bump_keywords(new.user_id, new.query, null, w);
    return new;
  end if;

  select * into ch from public.challenges where id = new.challenge_id;
  if found then
    perform public.duel_bump_keywords(new.user_id, ch.title, ch.tags, w);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_keywords_activities on public.activities;
create trigger trg_keywords_activities after insert on public.activities
  for each row execute function public.duel_fn_keyword_behaviour();

/** Searches that never became an activity row (e.g. untracked clients). */
create or replace function public.duel_fn_keyword_search()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null or coalesce(new.query, '') = '' then
    return new;
  end if;

  perform public.duel_bump_keywords(
    new.user_id,
    new.query,
    null,
    2.5
  );

  return new;
end;
$$;

drop trigger if exists trg_keywords_searches on public.searches;
create trigger trg_keywords_searches after insert on public.searches
  for each row execute function public.duel_fn_keyword_search();

/** A user's own posts also signal interest in what they're documenting. */
create or replace function public.duel_fn_keyword_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  perform public.duel_bump_keywords(
    new.user_id,
    new.note,
    null,
    2.0
  );

  return new;
end;
$$;

drop trigger if exists trg_keywords_checkins on public.challenge_checkins;
create trigger trg_keywords_checkins after insert on public.challenge_checkins
  for each row execute function public.duel_fn_keyword_checkin();

-- ----------------------------------------------------------------------------
-- 2. POST-LEVEL SOCIAL (likes + comments on challenge_checkins)
-- ----------------------------------------------------------------------------

create table if not exists public.checkin_likes (
  checkin_id uuid not null references public.challenge_checkins(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);

create table if not exists public.checkin_comments (
  id         uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.challenge_checkins(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_checkin_likes_checkin on public.checkin_likes (checkin_id);
create index if not exists idx_checkin_likes_user    on public.checkin_likes (user_id);
create index if not exists idx_checkin_comments_ck   on public.checkin_comments (checkin_id, created_at);
create index if not exists idx_checkin_comments_user on public.checkin_comments (user_id);

-- challenge_checkins in this database originally has no media columns.
-- Add them because the Duel feed supports image/video posts.
alter table public.challenge_checkins
  add column if not exists media_url text;

alter table public.challenge_checkins
  add column if not exists media_type text;

-- Keep media_type nullable for existing text-only check-ins.
-- New media posts should use 'image' or 'video'.
alter table public.challenge_checkins
  drop constraint if exists challenge_checkins_media_type_check;

alter table public.challenge_checkins
  add constraint challenge_checkins_media_type_check
  check (media_type is null or media_type in ('image', 'video'));

alter table public.challenge_checkins add column if not exists like_count    int not null default 0;
alter table public.challenge_checkins add column if not exists comment_count int not null default 0;

/** Denormalised counters for post-level interactions. */
create or replace function public.duel_fn_bump_post_counter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  col text;
  delta int;
begin
  col := tg_argv[0];
  if tg_op = 'INSERT' then delta := 1; elsif tg_op = 'DELETE' then delta := -1; else return null; end if;
  if tg_op = 'DELETE' then
    execute format('update public.challenge_checkins set %I = greatest(0, %I + $1) where id = $2', col, col)
      using delta, old.checkin_id;
    return old;
  else
    execute format('update public.challenge_checkins set %I = greatest(0, %I + $1) where id = $2', col, col)
      using delta, new.checkin_id;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_post_like_count on public.checkin_likes;
create trigger trg_post_like_count after insert or delete on public.checkin_likes
  for each row execute function public.duel_fn_bump_post_counter('like_count');

drop trigger if exists trg_post_comment_count on public.checkin_comments;
create trigger trg_post_comment_count after insert or delete on public.checkin_comments
  for each row execute function public.duel_fn_bump_post_counter('comment_count');

/** Notify the post author when someone likes or comments on their day post. */
create or replace function public.duel_fn_notify_post_social() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ck   public.challenge_checkins%rowtype;
  ch   public.challenges%rowtype;
  actor public.profiles%rowtype;
  kind text := tg_argv[0];
begin
  select * into ck from public.challenge_checkins where id = new.checkin_id;
  if not found then return new; end if;
  if ck.user_id = new.user_id then return new; end if; -- no self-notifications

  select * into ch from public.challenges where id = ck.challenge_id;
  select * into actor from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, actor_id, kind, challenge_id, body)
  values (ck.user_id, new.user_id, kind, ck.challenge_id,
          case kind
            when 'like' then format('%s liked your Day %s post on %s',
                                    coalesce(actor.display_name, 'Someone'), ck.day_number, coalesce(ch.title, 'a challenge'))
            else format('%s commented on your Day %s post on %s',
                        coalesce(actor.display_name, 'Someone'), ck.day_number, coalesce(ch.title, 'a challenge'))
          end);
  return new;
end;
$$;

drop trigger if exists trg_notify_post_like on public.checkin_likes;
create trigger trg_notify_post_like after insert on public.checkin_likes
  for each row execute function public.duel_fn_notify_post_social('like');

drop trigger if exists trg_notify_post_comment on public.checkin_comments;
create trigger trg_notify_post_comment after insert on public.checkin_comments
  for each row execute function public.duel_fn_notify_post_social('comment');

-- ----------------------------------------------------------------------------
-- 3. EXPLORE FEED — reels-style ranking of public posts
-- ----------------------------------------------------------------------------

/**
 * Public post discovery feed.
 *
 *  p_media_type 'video' | 'image' | null (any)
 *  p_category   category id | null (any)
 *  p_query      keyword filter over note + challenge title | null
 *  p_sort       'for_you' (ranked) | 'latest' (chronological)
 *  p_limit      page size (1..40)
 *  p_offset     row offset for pagination
 *
 * Returns one row per post with everything the feed card needs
 * (author profile, challenge, category, counters, my-liked flag).
 *
 * Ranking ("for_you"):
 *   34% category affinity   — user_category_affinity from tracked behaviour
 *   24% keyword overlap     — user_keywords learned from likes/searches/posts
 *   16% creator affinity    — your logged interactions with the author
 *   12% engagement          — post like/comment counts (log scale)
 *   14% freshness           — exp decay, ~72h half-life window
 *   + stable per-viewer jitter (0..0.4)
 * Diversity: ≤2 posts per challenge and ≤3 per category per page.
 * Cold start (no signals): engagement + freshness + jitter dominate.
 */
create or replace function public.duel_feed(
  p_media_type text default null,
  p_category   text default null,
  p_query      text default null,
  p_sort       text default 'for_you',
  p_limit      int default 20,
  p_offset     int default 0
)
returns table (
  post_id          uuid,
  day_number       int,
  note             text,
  media_url        text,
  media_type       text,
  checkin_date     date,
  created_at       timestamptz,
  like_count       int,
  comment_count    int,
  my_liked         boolean,
  is_mine          boolean,
  challenge_id     uuid,
  challenge_title  text,
  duration_days    int,
  category_id      text,
  category_name    text,
  category_emoji   text,
  author_id        uuid,
  author_name      text,
  author_username  text,
  author_avatar    text
)
language sql stable security definer set search_path = public as $$
  with viewer as (
    select public.duel_current_profile_id() as id
  ),
  candidates as (
    select ck.id as post_id, ck.challenge_id, ck.user_id as author_id,
           ck.day_number, ck.note, ck.media_url, ck.media_type,
           ck.checkin_date, ck.created_at, ck.like_count, ck.comment_count,
           c.title as challenge_title, c.duration_days, c.tags,
           c.category_id, cat.name as category_name, cat.emoji as category_emoji,
           extract(epoch from (now() - ck.created_at)) / 3600.0 as age_hours
      from public.challenge_checkins ck
      join public.challenges c on c.id = ck.challenge_id
      join public.duel_categories cat on cat.id = c.category_id
     where ck.media_url is not null and ck.media_type is not null
       and ck.created_at > now() - interval '60 days'
       and (p_media_type is null or ck.media_type = p_media_type)
       and (p_category is null or c.category_id = p_category)
       and (p_query is null or p_query = ''
            or ck.note ilike '%' || p_query || '%'
            or c.title ilike '%' || p_query || '%')
     order by ck.created_at desc
     limit 500
  ),
  scored as (
    select cd.*,
           /* category affinity (normalized below) */
           coalesce(aff.score, 0) as cat_raw,
           /* keyword overlap: viewer's learned keywords ∩ post keywords */
           (select coalesce(sum(uk.weight), 0)
              from public.user_keywords uk
             where uk.user_id = v.id
               and uk.keyword = any (
                     array_remove(
                       array_cat(
                         array_cat(
                           public.duel_tokenize(cd.note),
                           public.duel_tokenize(cd.challenge_title)
                         ),
                         coalesce(
                           (select array_agg(lower(t)) from unnest(coalesce(cd.tags, array[]::text[])) t),
                           array[]::text[]
                         )
                       ),
                       null
                     )
                   )
           ) as kw_raw,
           /* creator affinity: logged interactions with this author */
           (select coalesce(sum(case a.action
                                  when 'join' then 6.0 when 'complete' then 8.0
                                  when 'save' then 4.0 when 'like' then 3.0
                                  when 'comment' then 3.0 when 'share' then 3.0
                                  when 'checkin' then 2.0 when 'create' then 4.0
                                  else 1.0 end), 0)
              from public.activities a
             where a.user_id = v.id and a.challenge_id is not null
               and exists (select 1 from public.challenges c2
                            where c2.id = a.challenge_id and c2.creator_id = cd.author_id)
           ) as creator_raw,
           ln(1 + cd.like_count + 2.0 * cd.comment_count) as eng_raw,
           exp(-cd.age_hours / 72.0) as fresh_raw
      from candidates cd
      cross join viewer v
      left join public.user_category_affinity aff
        on aff.user_id = v.id and aff.category_id = cd.category_id
  ),
  normalized as (
    select s.*,
           ( 0.34 * greatest(0, s.cat_raw) / greatest(0.0001, (select max(greatest(0, cat_raw)) from scored))
           + 0.24 * s.kw_raw / greatest(0.0001, (select max(kw_raw) from scored))
           + 0.16 * ln(1 + s.creator_raw) / greatest(0.0001, (select max(ln(1 + creator_raw)) from scored))
           + 0.12 * s.eng_raw / greatest(0.0001, (select max(eng_raw) from scored))
           + 0.14 * s.fresh_raw
           ) * 100
           + (hashtext(coalesce(v.id::text, 'anon') || s.post_id::text) % 1000) / 2500.0
             as score
      from scored s
      cross join viewer v
  ),
  diverse as (
    select n.*,
           row_number() over (partition by challenge_id  order by score desc) as rn_challenge,
           row_number() over (partition by category_id   order by score desc) as rn_category
      from normalized n
  )
  select d.post_id, d.day_number, d.note, d.media_url, d.media_type,
         d.checkin_date, d.created_at, d.like_count, d.comment_count,
         exists (select 1 from public.checkin_likes cl
                  where cl.checkin_id = d.post_id and cl.user_id = v.id) as my_liked,
         (d.author_id = v.id) as is_mine,
         d.challenge_id, d.challenge_title, d.duration_days,
         d.category_id, d.category_name, d.category_emoji,
         d.author_id, p.display_name, p.username, p.avatar_url
    from diverse d
    cross join viewer v
    join public.profiles p on p.id = d.author_id
   where (p_sort = 'latest'
          or (d.rn_challenge <= 2 and d.rn_category <= 3))
   order by case when p_sort = 'latest' then null else d.score end desc,
            d.created_at desc
   limit least(coalesce(p_limit, 20), 40)
   offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ----------------------------------------------------------------------------
-- 4. GLOBAL TRENDING CHALLENGES
-- ----------------------------------------------------------------------------

/** True top-N open challenges by weighted popularity (participants, likes, saves). */
create or replace function public.duel_trending(p_limit int default 8)
returns table (
  challenge_id uuid, title text, category_id text, category_name text,
  category_emoji text, duration_days int, difficulty text, daily_task text,
  cover_url text, tags text[], creator_id uuid, status text,
  participant_count int, like_count int, comment_count int, save_count int,
  share_count int, view_count int, completion_count int, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.category_id, cat.name, cat.emoji,
         c.duration_days, c.difficulty, c.daily_task, c.cover_url, c.tags,
         c.creator_id, c.status, c.participant_count, c.like_count, c.comment_count,
         c.save_count, c.share_count, c.view_count, c.completion_count, c.created_at
    from public.challenges c
    join public.duel_categories cat on cat.id = c.category_id
   where c.status = 'open'
   order by (c.participant_count + c.like_count * 2 + c.save_count) desc,
            c.created_at desc
   limit least(coalesce(p_limit, 8), 50);
$$;

-- ----------------------------------------------------------------------------
-- 5. RECOMMENDATIONS WITH KEYWORD COMPONENT
-- ----------------------------------------------------------------------------

create or replace function public.duel_refresh_recommendations(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  interactions int;
  max_pop double precision;
  max_eng double precision;
  max_aff double precision;
  max_bkt double precision;
  max_kw  double precision;
begin
  select coalesce(sum(interactions), 0) into interactions
    from public.user_category_affinity where user_id = p_user;

  select coalesce(max(ln(1 + participant_count + like_count * 2 + save_count)), 0.0001) into max_pop
    from public.challenges where status = 'open';

  select coalesce(max((like_count + save_count * 1.2 + share_count * 1.5 + comment_count) / greatest(1, view_count + 1)), 0.0001) into max_eng
    from public.challenges where status = 'open';

  select coalesce(max(score), 0.0001) into max_aff
    from public.user_category_affinity where user_id = p_user;

  select coalesce(max(greatest(bucket_sprint, bucket_short, bucket_classic, bucket_marathon)), 0.0001) into max_bkt
    from public.user_category_affinity where user_id = p_user;

  select coalesce(max(kw.score), 0.0001) into max_kw
    from (
      select coalesce(sum(uk.weight), 0) as score
        from public.challenges c
        left join public.user_keywords uk
          on uk.user_id = p_user
         and uk.keyword = any (
               array_remove(
                 array_cat(
                   array_cat(
                     public.duel_tokenize(c.title),
                     public.duel_tokenize(c.description)
                   ),
                   coalesce(
                     (select array_agg(lower(t)) from unnest(coalesce(c.tags, array[]::text[])) t),
                     array[]::text[]
                   )
                 ),
                 null
               )
             )
       where c.status = 'open'
       group by c.id
    ) kw;

  delete from public.recommendations where user_id = p_user;

  insert into public.recommendations (user_id, challenge_id, score, reason)
  select p_user, c.id,
         ( 0.32 * greatest(0, coalesce(a.score, 0)) / max_aff
         + 0.10 * greatest(0, case
                when c.duration_days <= 7  then coalesce(a.bucket_sprint, 0)
                when c.duration_days <= 14 then coalesce(a.bucket_short, 0)
                when c.duration_days <= 30 then coalesce(a.bucket_classic, 0)
                else coalesce(a.bucket_marathon, 0) end) / max_bkt
         + 0.28 * ln(1 + c.participant_count + c.like_count * 2 + c.save_count) / max_pop
         + 0.10 * ((c.like_count + c.save_count * 1.2 + c.share_count * 1.5 + c.comment_count) / greatest(1, c.view_count + 1)) / max_eng
         + 0.08 * exp(-extract(epoch from (now() - c.created_at)) / 86400.0 / 45.0)
         + 0.12 * coalesce(kw.score, 0) / max_kw
         ) * 100
         + (hashtext(p_user::text || c.id::text) % 1000) / 500.0,
         case
           when interactions = 0 and coalesce(kw.score, 0) = 0 then
             case when c.participant_count > 1500 then 'Popular this week in ' || cat.name
                  else 'Staff pick in ' || cat.name end
           when coalesce(kw.score, 0) >= max_kw * 0.6 and topkw.k is not null then
             'Matches your interest in "' || topkw.k || '"'
           when coalesce(a.score, 0) > 0 and joined.t is not null then 'Because you joined ' || joined.t
           when coalesce(a.score, 0) > 0 then 'You keep exploring ' || cat.name
           when c.participant_count > 1500 then 'Trending in ' || cat.name
           else 'Fresh in ' || cat.name
         end
    from public.challenges c
    join public.duel_categories cat on cat.id = c.category_id
    left join public.user_category_affinity a on a.user_id = p_user and a.category_id = c.category_id
    left join lateral (
      select coalesce(sum(uk2.weight), 0) as score
        from public.user_keywords uk2
       where uk2.user_id = p_user
         and uk2.keyword = any (
               array_remove(
                 array_cat(
                   array_cat(
                     public.duel_tokenize(c.title),
                     public.duel_tokenize(c.description)
                   ),
                   coalesce(
                     (select array_agg(lower(t)) from unnest(coalesce(c.tags, array[]::text[])) t),
                     array[]::text[]
                   )
                 ),
                 null
               )
             )
    ) kw on true
    left join lateral (
      select uk3.keyword as k
        from public.user_keywords uk3
       where uk3.user_id = p_user
         and uk3.keyword = any (
               array_remove(
                 array_cat(
                   array_cat(
                     public.duel_tokenize(c.title),
                     public.duel_tokenize(c.description)
                   ),
                   coalesce(
                     (select array_agg(lower(t)) from unnest(coalesce(c.tags, array[]::text[])) t),
                     array[]::text[]
                   )
                 ),
                 null
               )
             )
       order by uk3.weight desc
       limit 1
    ) topkw on true
    left join lateral (
      select ch2.title t
        from public.challenge_participants p2
        join public.challenges ch2 on ch2.id = p2.challenge_id
       where p2.user_id = p_user and p2.challenge_id <> c.id
         and ch2.category_id = c.category_id and p2.status in ('active','completed')
       limit 1
    ) joined on true
   where c.status = 'open'
     and not exists (select 1 from public.challenge_participants p where p.challenge_id = c.id and p.user_id = p_user)
     and not exists (select 1 from public.activities a3 where a3.user_id = p_user
                      and a3.action = 'not_interested' and a3.challenge_id = c.id)
   order by 3 desc
   limit 60;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------

alter table public.user_keywords enable row level security;
alter table public.checkin_likes enable row level security;
alter table public.checkin_comments enable row level security;

drop policy if exists user_keywords_own on public.user_keywords;
create policy user_keywords_own on public.user_keywords for select
  using (user_id = public.duel_current_profile_id());
drop policy if exists user_keywords_write on public.user_keywords;
create policy user_keywords_write on public.user_keywords for insert
  with check (user_id = public.duel_current_profile_id());

-- Posts: public read (RLS on challenge_checkins already allows public select);
-- writes are self-only, matching the existing checkins policies.
drop policy if exists post_likes_read on public.checkin_likes;
create policy post_likes_read on public.checkin_likes for select using (true);
drop policy if exists post_likes_insert on public.checkin_likes;
create policy post_likes_insert on public.checkin_likes for insert
  with check (user_id = public.duel_current_profile_id());
drop policy if exists post_likes_delete on public.checkin_likes;
create policy post_likes_delete on public.checkin_likes for delete
  using (user_id = public.duel_current_profile_id());

drop policy if exists post_comments_read on public.checkin_comments;
create policy post_comments_read on public.checkin_comments for select using (true);
drop policy if exists post_comments_insert on public.checkin_comments;
create policy post_comments_insert on public.checkin_comments for insert
  with check (user_id = public.duel_current_profile_id());
drop policy if exists post_comments_delete on public.checkin_comments;
create policy post_comments_delete on public.checkin_comments for delete
  using (user_id = public.duel_current_profile_id());
