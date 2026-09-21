-- ============================================================================
-- DUEL — UNIFIED DAILY-POSTS MODEL + FULL SECURITY AUDIT (2026-09-23)
--
-- Conceptual model (single write path, single read path):
--
--   User → creates/joins → Challenge
--        → contains      → challenge_participants
--        → produces      → challenge_posts   (ONE daily entry per user/day)
--        → contains      → challenge_post_media (images + videos)
--
--   challenge_checkins becomes a derived LEDGER (1:1 with challenge_posts),
--   maintained exclusively by triggers — it keeps streaks/progress fast and
--   preserves existing rows. Clients can no longer write it directly.
--
-- WHAT THIS MIGRATION DOES
--   1. Moves user settings out of `profiles.settings` (publicly readable leak)
--      into a private `user_settings` table.
--   2. Adds `challenge_posts.post_date` and backfills one challenge_post (+media)
--      for every legacy challenge_checkins row, so all content lives in the
--      Daily Posts → Media structure.
--   3. Unifies post interactions: `checkin_likes` / `checkin_comments` data is
--      migrated into `challenge_post_likes` / `challenge_post_comments` and the
--      legacy tables are dropped.
--   4. Replaces the check-in engine with a posts → ledger projection +
--      `duel_recompute_participation()` (day-slot streaks, completion,
--      notifications). `duel_submit_daily_post()` is THE write API;
--      `duel_checkin()` remains as a thin back-compat wrapper.
--   5. Rebuilds `duel_feed()`, `get_challenge_timeline()`, `get_explore_posts()`
--      and adds `get_user_posts()` on top of challenge_posts + media.
--   6. Messaging hardening: conversation membership is no longer readable by
--      strangers, users cannot insert themselves into foreign conversations,
--      `last_message_at` + message notifications are trigger-maintained, and
--      `duel_open_conversation` only matches true 1-to-1 threads.
--   7. Replaces EVERY RLS policy on every table with an explicit, audited
--      policy set (SELECT/INSERT/UPDATE/DELETE) using auth.uid() /
--      duel_current_profile_id() and parent-record ownership checks.
--   8. Creates the Supabase Storage buckets (`duel-media`, `duel-chat`) with
--      object-level RLS: users may only write inside their own
--      `auth.uid()`-folder, public media is world-readable, chat media is
--      readable only by the uploader and their conversation partners.
--
-- Idempotent: safe to re-run. Run after 20260922100000_sync_checkins_with_posts.sql.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- ============================================================================
-- 0. HELPERS
-- ============================================================================

create or replace function public.duel_current_profile_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.handle_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop every policy on a table (used before restating the audited policy set).
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in (
         'profiles', 'user_settings', 'duel_categories', 'challenges',
         'challenge_participants', 'challenge_posts', 'challenge_post_media',
         'challenge_post_likes', 'challenge_post_comments', 'challenge_checkins',
         'challenge_likes', 'challenge_saves', 'challenge_shares', 'challenge_comments',
         'activities', 'searches', 'user_category_affinity', 'recommendations',
         'user_keywords', 'notifications', 'conversations', 'conversation_participants',
         'messages', 'app_settings'
       )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ============================================================================
-- 0b. SIGNUP FIX — the old partial unique index (user_id where user_id is not
--     null) has no matching ON CONFLICT arbiter for handle_new_user(), which
--     made every signup fail with "Database error saving new user" on fresh
--     databases. Replace it with a plain unique index (NULLs still allowed).
-- ============================================================================

drop index if exists public.idx_profiles_user_id;
create unique index if not exists idx_profiles_user_id on public.profiles (user_id);

-- ============================================================================
-- 1. PRIVATE USER SETTINGS (moved out of the publicly readable profiles row)
-- ============================================================================

create table if not exists public.user_settings (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name = 'settings') then
    insert into public.user_settings (user_id, settings)
    select id, coalesce(settings, '{}'::jsonb)
      from public.profiles
     where settings is not null and settings <> '{}'::jsonb
    on conflict (user_id) do nothing;

    alter table public.profiles drop column settings;
  end if;
end $$;

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at before update on public.user_settings
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- 2. CHALLENGE_POSTS — THE daily entries. Add post_date + rules trigger.
-- ============================================================================

alter table public.challenge_posts
  add column if not exists post_date date not null default current_date;

create index if not exists idx_challenge_posts_day
  on public.challenge_posts (challenge_id, user_id, day_number);
create index if not exists idx_challenge_posts_date
  on public.challenge_posts (challenge_id, post_date);

-- A daily post must belong to a participant of its challenge, fit the
-- challenge length and never be dated in the future — enforced at row level,
-- so it holds no matter which API surface (RPC / PostgREST) wrote the row.
create or replace function public.duel_fn_post_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ch public.challenges%rowtype;
  v_me uuid;
begin
  select * into ch from public.challenges where id = new.challenge_id;
  if not found then raise exception 'challenge not found'; end if;

  v_me := public.duel_current_profile_id();

  if tg_op = 'INSERT' then
    -- Self-only authorship (system backfills run with no JWT and pass).
    if v_me is not null and new.user_id <> v_me then
      raise exception 'a daily post can only be created for yourself';
    end if;

    -- Must be a participant — unless this INSERT is really the upsert of an
    -- existing day-slot (the row already exists for the same user).
    if not exists (select 1 from public.challenge_participants p
                    where p.challenge_id = new.challenge_id and p.user_id = new.user_id)
       and not exists (select 1 from public.challenge_posts q
                        where q.challenge_id = new.challenge_id and q.user_id = new.user_id
                          and q.day_number = new.day_number) then
      raise exception 'join the challenge before posting';
    end if;
  else
    -- UPDATE: identity fields are immutable (counter triggers only touch
    -- like_count / comment_count and must not trip this).
    if new.user_id is distinct from old.user_id
       or new.challenge_id is distinct from old.challenge_id
       or new.day_number is distinct from old.day_number
       or new.post_date is distinct from old.post_date then
      raise exception 'a daily post cannot be moved between days, users or challenges';
    end if;
  end if;

  if new.day_number < 1 or new.day_number > ch.duration_days then
    raise exception 'day % is outside this challenge (1–%)', new.day_number, ch.duration_days;
  end if;

  if new.post_date > current_date then
    raise exception 'a daily post cannot be dated in the future';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_challenge_posts_rules on public.challenge_posts;
create trigger trg_challenge_posts_rules before insert or update on public.challenge_posts
  for each row execute function public.duel_fn_post_rules();

-- ============================================================================
-- 3. LEDGER ENGINE — challenge_checkins is derived from challenge_posts
-- ============================================================================

drop trigger if exists trg_duel_apply_checkin on public.challenge_checkins;
drop trigger if exists trg_post_like_counter on public.challenge_post_likes;
drop trigger if exists trg_post_comment_counter on public.challenge_post_comments;

drop function if exists public.duel_fn_apply_checkin();
drop function if exists public.duel_checkin(uuid, text, text, text, int);

-- The day-slot is the canonical key of a daily entry. The old
-- "one check-in per calendar date" unique constraint conflicts with the
-- day-slot model (back-filled days and target dates can collide), so it goes.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.challenge_checkins'::regclass
       and contype = 'u'
       and (select array_agg(a.attname order by a.attname)
              from unnest(conkey) k
              join pg_attribute a on a.attrelid = conrelid and a.attnum = k) =
           array['challenge_id', 'checkin_date', 'user_id']::name[]
  loop
    execute format('alter table public.challenge_checkins drop constraint %I', r.conname);
  end loop;
end $$;

-- Recompute a participant's progress from their daily posts:
--   completed_days = number of posts
--   current_streak = length of the contiguous day run ending at their top day
--   longest_streak = max(previous, current)
--   completion when completed_days reaches the challenge duration (and undo on
--   deletion, so counters can never drift).
create or replace function public.duel_recompute_participation(
  p_challenge uuid, p_user uuid, p_notify boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare
  ch public.challenges%rowtype;
  part public.challenge_participants%rowtype;
  v_count int;
  v_max_day int;
  v_streak int;
  v_last_date date;
  v_status text;
begin
  select * into ch from public.challenges where id = p_challenge;
  if not found then return; end if;

  select * into part from public.challenge_participants
   where challenge_id = p_challenge and user_id = p_user;
  if not found then return; end if;

  select count(*), max(day_number), max(post_date)
    into v_count, v_max_day, v_last_date
    from public.challenge_posts
   where challenge_id = p_challenge and user_id = p_user;

  if v_max_day is null then
    v_streak := 0;
  else
    with days as (
      select day_number
        from public.challenge_posts
       where challenge_id = p_challenge and user_id = p_user
    ), islands as (
      select day_number, day_number - row_number() over (order by day_number) as grp
        from days
    ), top_island as (
      select grp from islands where day_number = v_max_day
    )
    select count(*) into v_streak from islands where grp = (select grp from top_island);
  end if;

  v_status := part.status;
  if v_count >= ch.duration_days then
    v_status := 'completed';
  elsif part.status = 'completed' then
    v_status := 'active'; -- a post was removed — reopen the duel
  end if;

  update public.challenge_participants
     set completed_days   = v_count,
         current_streak   = v_streak,
         longest_streak   = greatest(part.longest_streak, v_streak),
         last_checkin_date = v_last_date,
         status           = v_status,
         completed_at     = case when v_status = 'completed' then
                                   coalesce(part.completed_at, now())
                                 else null end
   where challenge_id = p_challenge and user_id = p_user;

  if v_status = 'completed' and part.status <> 'completed' then
    update public.challenges set completion_count = completion_count + 1 where id = ch.id;
    if p_notify then
      insert into public.notifications (user_id, actor_id, kind, challenge_id, body)
      values (p_user, null, 'streak', ch.id,
              format('Challenge complete: %s. %s days, done. Badge earned.', ch.title, ch.duration_days));
      insert into public.notifications (user_id, actor_id, kind, challenge_id, body)
      select ch.creator_id, p_user, 'complete', ch.id,
             format('%s completed your challenge %s', pr.display_name, ch.title)
        from public.profiles pr where pr.id = p_user and ch.creator_id <> p_user;
    end if;
  elsif v_status <> 'completed' and part.status = 'completed' then
    update public.challenges
       set completion_count = greatest(0, completion_count - 1)
     where id = ch.id;
  elsif p_notify and v_streak > part.current_streak and v_streak in (3, 7, 14, 21, 30, 50, 100) then
    insert into public.notifications (user_id, actor_id, kind, challenge_id, body)
    values (p_user, null, 'streak', ch.id,
            format('%s-day streak on %s. Do not break the chain.', v_streak, ch.title));
  end if;
end;
$$;

-- Posts → ledger projection (challenge_checkins), keyed by (challenge,user,day).
create or replace function public.duel_sync_post_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_media record;
  v_op text := tg_op;
begin
  if v_op = 'DELETE' then
    delete from public.challenge_checkins
     where challenge_id = old.challenge_id and user_id = old.user_id and day_number = old.day_number;
    perform public.duel_recompute_participation(old.challenge_id, old.user_id);
    return old;
  end if;

  select media_type, url into v_media
    from public.challenge_post_media
   where post_id = new.id
   order by sort_order, created_at
   limit 1;

  insert into public.challenge_checkins
      (challenge_id, user_id, day_number, checkin_date, note, media_url, media_type, created_at)
  values (new.challenge_id, new.user_id, new.day_number, new.post_date,
          new.caption, v_media.url, v_media.media_type, new.created_at)
  on conflict (challenge_id, user_id, day_number) do update
     set checkin_date = excluded.checkin_date,
         note         = excluded.note,
         media_url    = excluded.media_url,
         media_type   = excluded.media_type;

  perform public.duel_recompute_participation(new.challenge_id, new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_sync_post_checkin on public.challenge_posts;
create trigger trg_sync_post_checkin after insert or update or delete on public.challenge_posts
  for each row execute function public.duel_sync_post_checkin();

-- Keep the ledger's "first media" snapshot in sync with the post's media.
create or replace function public.duel_sync_post_media() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_post public.challenge_posts%rowtype;
  v_media record;
  v_id uuid;
begin
  v_id := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  select * into v_post from public.challenge_posts where id = v_id;
  if not found then return null; end if;

  select media_type, url into v_media
    from public.challenge_post_media
   where post_id = v_id
   order by sort_order, created_at
   limit 1;

  update public.challenge_checkins
     set media_url  = v_media.url,
         media_type = v_media.media_type
   where challenge_id = v_post.challenge_id
     and user_id = v_post.user_id
     and day_number = v_post.day_number;

  return null;
end;
$$;

drop trigger if exists trg_sync_post_media on public.challenge_post_media;
create trigger trg_sync_post_media after insert or update or delete on public.challenge_post_media
  for each row execute function public.duel_sync_post_media();

-- Post like / comment counters on challenge_posts.
create or replace function public.duel_fn_post_like_counter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.challenge_posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.challenge_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_post_like_counter on public.challenge_post_likes;
create trigger trg_post_like_counter after insert or delete on public.challenge_post_likes
  for each row execute function public.duel_fn_post_like_counter();

create or replace function public.duel_fn_post_comment_counter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.challenge_posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.challenge_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_post_comment_counter on public.challenge_post_comments;
create trigger trg_post_comment_counter after insert or delete on public.challenge_post_comments
  for each row execute function public.duel_fn_post_comment_counter();

-- ============================================================================
-- 4. BACKFILL: every legacy check-in becomes a daily post (+ media)
--    and checkin_likes / checkin_comments move to the post tables.
-- ============================================================================

insert into public.challenge_posts (challenge_id, user_id, day_number, post_date, caption, created_at)
select ck.challenge_id, ck.user_id, ck.day_number, ck.checkin_date, coalesce(ck.note, ''), ck.created_at
  from public.challenge_checkins ck
 where not exists (
   select 1 from public.challenge_posts p
    where p.challenge_id = ck.challenge_id and p.user_id = ck.user_id and p.day_number = ck.day_number
 );

insert into public.challenge_post_media (post_id, media_type, url, sort_order, created_at)
select p.id,
       ck.media_type,
       ck.media_url,
       0,
       ck.created_at
  from public.challenge_checkins ck
  join public.challenge_posts p
    on p.challenge_id = ck.challenge_id and p.user_id = ck.user_id and p.day_number = ck.day_number
 where ck.media_url is not null
   and ck.media_type in ('image', 'video')
   and not exists (select 1 from public.challenge_post_media m where m.post_id = p.id);

do $$
begin
  if to_regclass('public.checkin_likes') is not null then
    insert into public.challenge_post_likes (post_id, user_id, created_at)
    select p.id, l.user_id, l.created_at
      from public.checkin_likes l
      join public.challenge_checkins ck on ck.id = l.checkin_id
      join public.challenge_posts p
        on p.challenge_id = ck.challenge_id and p.user_id = ck.user_id and p.day_number = ck.day_number
    on conflict do nothing;
  end if;

  if to_regclass('public.checkin_comments') is not null then
    insert into public.challenge_post_comments (id, post_id, user_id, body, created_at)
    select c.id, p.id, c.user_id, c.body, c.created_at
      from public.checkin_comments c
      join public.challenge_checkins ck on ck.id = c.checkin_id
      join public.challenge_posts p
        on p.challenge_id = ck.challenge_id and p.user_id = ck.user_id and p.day_number = ck.day_number
    on conflict do nothing;
  end if;

  drop table if exists public.checkin_likes cascade;
  drop table if exists public.checkin_comments cascade;
end $$;

-- ============================================================================
-- 5. THE WRITE API — submit (create or edit) a daily post with media
-- ============================================================================

create or replace function public.duel_submit_daily_post(
  p_challenge_id uuid,
  p_day_number int,
  p_caption text default '',
  p_media jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.duel_current_profile_id();
  ch public.challenges%rowtype;
  part public.challenge_participants%rowtype;
  v_post public.challenge_posts%rowtype;
  v_target date;
  v_item jsonb;
  v_sort int := 0;
begin
  if me is null then raise exception 'not signed in'; end if;

  select * into ch from public.challenges where id = p_challenge_id;
  if not found then raise exception 'challenge not found'; end if;

  select * into part from public.challenge_participants
   where challenge_id = p_challenge_id and user_id = me;
  if not found then raise exception 'join the challenge before posting'; end if;

  if p_day_number is null or p_day_number < 1 or p_day_number > ch.duration_days then
    raise exception 'day % is outside this challenge (1–%)', coalesce(p_day_number::text, '?'), ch.duration_days;
  end if;

  v_target := (part.joined_at::date + (p_day_number - 1));
  if v_target > current_date then
    raise exception 'day % has not started yet', p_day_number;
  end if;

  if coalesce(trim(p_caption), '') = '' and coalesce(jsonb_array_length(p_media), 0) = 0 then
    raise exception 'a daily post needs a caption or media';
  end if;

  insert into public.challenge_posts (challenge_id, user_id, day_number, post_date, caption)
  values (p_challenge_id, me, p_day_number, v_target, coalesce(p_caption, ''))
  on conflict (challenge_id, user_id, day_number) do update
     set caption = excluded.caption,
         updated_at = now()
  returning * into v_post;

  -- Media is replaced as a set when supplied (null keeps the current set).
  if p_media is not null then
    delete from public.challenge_post_media where post_id = v_post.id;
    for v_item in select * from jsonb_array_elements(p_media) loop
      if v_item->>'type' not in ('image', 'video') then
        raise exception 'unsupported media type';
      end if;
      if coalesce(v_item->>'url', '') = '' then
        raise exception 'media entry is missing its url';
      end if;
      insert into public.challenge_post_media
          (post_id, media_type, url, thumbnail_url, width, height, duration_ms, file_size, sort_order)
      values (v_post.id,
              v_item->>'type',
              v_item->>'url',
              nullif(v_item->>'thumbnailUrl', ''),
              nullif(v_item->>'width', '')::int,
              nullif(v_item->>'height', '')::int,
              nullif(v_item->>'durationMs', '')::int,
              nullif(v_item->>'fileSize', '')::bigint,
              v_sort);
      v_sort := v_sort + 1;
    end loop;
  end if;

  perform public.duel_track('checkin', ch.id, ch.category_id,
            case when ch.duration_days <= 7 then 'sprint'
                 when ch.duration_days <= 14 then 'short'
                 when ch.duration_days <= 30 then 'classic'
                 else 'marathon' end, null);

  select * into part from public.challenge_participants
   where challenge_id = p_challenge_id and user_id = me;

  return jsonb_build_object(
    'post', (select to_jsonb(v_post) || jsonb_build_object('media', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', m.id, 'mediaType', m.media_type, 'url', m.url,
                        'thumbnailUrl', m.thumbnail_url, 'width', m.width, 'height', m.height,
                        'durationMs', m.duration_ms, 'fileSize', m.file_size,
                        'sortOrder', m.sort_order) order by m.sort_order)
               from public.challenge_post_media m where m.post_id = v_post.id), '[]'::jsonb))),
    'participation', jsonb_build_object(
      'challenge_id', part.challenge_id, 'status', part.status, 'joined_at', part.joined_at,
      'current_streak', part.current_streak, 'longest_streak', part.longest_streak,
      'completed_days', part.completed_days, 'last_checkin_date', part.last_checkin_date,
      'completed_at', part.completed_at)
  );
end;
$$;

-- Back-compat wrapper: the old check-in call becomes a one-media daily post.
create or replace function public.duel_checkin(
  p_challenge_id uuid,
  p_note text default '',
  p_media_url text default null,
  p_media_type text default null,
  p_day_number int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.duel_current_profile_id();
  v_day int;
  v_media jsonb := null;
  v_res jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;

  if p_day_number is null then
    select coalesce(max(day_number), 0) + 1 into v_day
      from public.challenge_posts
     where challenge_id = p_challenge_id and user_id = me;
  else
    v_day := p_day_number;
  end if;

  if p_media_url is not null and p_media_type in ('image', 'video') then
    v_media := jsonb_build_array(jsonb_build_object('type', p_media_type, 'url', p_media_url));
  end if;

  v_res := public.duel_submit_daily_post(p_challenge_id, v_day, coalesce(p_note, ''), v_media);
  return jsonb_build_object(
    'checkin', v_res->'post',
    'participation', v_res->'participation');
end;
$$;

-- One-time pass: bring every participation up to the day-slot model quietly.
select public.duel_recompute_participation(p.challenge_id, p.user_id, false)
  from public.challenge_participants p;

-- ============================================================================
-- 6. FEEDS ON TOP OF DAILY POSTS
-- ============================================================================

-- Media array for one post (used by all feed RPCs).
-- (Return-type changes vs older migrations require drop + recreate.)
drop function if exists public.get_challenge_timeline(uuid);
drop function if exists public.get_explore_posts(int);
drop function if exists public.get_user_posts(uuid, int);
drop function if exists public.duel_feed(text, text, text, text, int, int);

create or replace function public.duel_post_media_json(p_post uuid)
returns jsonb
language sql stable as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'id', m.id, 'type', m.media_type, 'url', m.url,
      'thumbnailUrl', m.thumbnail_url, 'width', m.width, 'height', m.height,
      'durationMs', m.duration_ms, 'fileSize', m.file_size,
      'sortOrder', m.sort_order) order by m.sort_order, m.created_at),
    '[]'::jsonb)
  from public.challenge_post_media m
  where m.post_id = p_post;
$$;

/**
 * Explore feed: real daily posts, discovery-ranked.
 *   34% category affinity · 24% keyword overlap · 12% creator affinity
 *   12% engagement · 14% freshness + stable per-user jitter
 * with diversity caps (≤2 per challenge, ≤3 per category). Text-only posts are
 * included unless a media filter is active. Cold start = engagement + freshness.
 */
create or replace function public.duel_feed(
  p_media_type text default null,
  p_category text default null,
  p_query text default null,
  p_sort text default 'for_you',
  p_limit int default 18,
  p_offset int default 0
) returns table (
  post_id uuid, challenge_id uuid, challenge_title text, duration_days int,
  category_id text, category_name text, category_emoji text,
  author_id uuid, author_name text, author_username text, author_avatar text,
  day_number int, checkin_date date, note text,
  media_url text, media_type text, media jsonb,
  created_at timestamptz, like_count int, comment_count int,
  my_liked boolean, is_mine boolean
)
language sql stable security definer set search_path = public as $$
  with viewer as (
    select public.duel_current_profile_id() as id
  ), base as (
    select p.id, p.challenge_id, p.user_id, p.created_at,
           p.day_number, p.post_date, p.caption, p.like_count, p.comment_count,
           public.duel_post_media_json(p.id) as media
      from public.challenge_posts p
      where (p_category is null or exists (select 1 from public.challenges cc
               where cc.id = p.challenge_id and cc.category_id = p_category))
        and (p_query is null or p_query = ''
             or p.caption ilike '%' || p_query || '%'
             or exists (select 1 from public.challenges c
                         where c.id = p.challenge_id
                           and (c.title ilike '%' || p_query || '%'
                                or c.description ilike '%' || p_query || '%'
                                or exists (select 1 from unnest(c.tags) t where t ilike '%' || p_query || '%')))
             or exists (select 1 from public.profiles pr
                         where pr.id = p.user_id
                           and (pr.username ilike '%' || p_query || '%'
                                or pr.display_name ilike '%' || p_query || '%')))
        and (p_media_type is null
             or exists (select 1 from jsonb_array_elements(public.duel_post_media_json(p.id)) m
                         where m->>'type' = p_media_type))
  ), scored as (
    select b.*,
           c2.category_id as category_id,
           c2.title as ch_title, c2.duration_days as ch_days,
           cat.name as cat_name, cat.emoji as cat_emoji,
           pr.display_name, pr.username, pr.avatar_url,
           coalesce(aff.score, 0) as aff_score,
           coalesce(kw.score, 0) as kw_score,
           (b.media->0->>'type') as first_type,
           ln(1 + b.like_count + b.comment_count * 2) as eng,
           exp(-extract(epoch from (now() - b.created_at)) / 86400.0 / 3.0) as fresh,
           (hashtext((select v.id::text from viewer v) || b.id::text) % 1000) / 500.0 as jitter,
           exists (select 1 from public.activities a
                    where a.user_id = (select id from viewer)
                      and a.challenge_id = b.challenge_id
                      and a.action in ('join', 'checkin', 'comment', 'like')) as touched
      from base b
      join public.challenges c2 on c2.id = b.challenge_id
      join public.duel_categories cat on cat.id = c2.category_id
      join public.profiles pr on pr.id = b.user_id
      left join public.user_category_affinity aff
        on aff.user_id = (select id from viewer) and aff.category_id = c2.category_id
      left join lateral (
        select coalesce(sum(uk.weight), 0) as score
          from public.user_keywords uk
         where uk.user_id = (select id from viewer)
           and uk.keyword = any (public.duel_tokenize(c2.title || ' ' || c2.description))
      ) kw on true
  ), norm as (
    select s.*,
           greatest((select coalesce(max(aff2.score), 0.0001) from public.user_category_affinity aff2
                      where aff2.user_id = (select id from viewer)), 0.0001) as max_aff,
           greatest((select coalesce(sum(uk2.weight), 0.0001) from public.user_keywords uk2
                      where uk2.user_id = (select id from viewer)), 0.0001) as max_kw
      from scored s
  ), ranked as (
    select n.*,
           row_number() over (order by n.created_at desc) as rn_latest,
           case when p_sort = 'latest' then 0 else
             ( 0.34 * least(1.0, n.aff_score / n.max_aff)
             + 0.24 * least(1.0, n.kw_score / n.max_kw)
             + 0.12 * case when n.touched then 1.0 else 0.0 end
             + 0.12 * least(1.0, n.eng / 3.0)
             + 0.14 * n.fresh ) + n.jitter
           end as score
      from norm n
  ), diverse as (
    select r.*,
           row_number() over (partition by r.challenge_id order by r.score desc, r.created_at desc) as rn_challenge,
           row_number() over (partition by r.category_id order by r.score desc, r.created_at desc) as rn_category
      from ranked r
  )
  select d.id, d.challenge_id, d.ch_title, d.ch_days,
         d.category_id, d.cat_name, d.cat_emoji,
         d.user_id, d.display_name, d.username, d.avatar_url,
         d.day_number, d.post_date, d.caption,
         d.media->0->>'url', d.media->0->>'type', d.media,
         d.created_at, d.like_count, d.comment_count,
         exists (select 1 from public.challenge_post_likes l
                  where l.post_id = d.id and l.user_id = (select id from viewer)) as my_liked,
         (d.user_id = (select id from viewer)) as is_mine
    from diverse d
   where (p_sort = 'latest' or (d.rn_challenge <= 2 and d.rn_category <= 3))
   order by case when p_sort = 'latest' then null else d.score end desc,
            case when p_sort = 'latest' then d.created_at end desc nulls last,
            d.created_at desc
   limit least(coalesce(p_limit, 18), 40)
   offset greatest(coalesce(p_offset, 0), 0);
$$;

-- All daily posts of one challenge — the challenge timeline (every participant,
-- text and media entries alike).
create or replace function public.get_challenge_timeline(p_challenge_id uuid)
returns table (
  post_id uuid, day_number int, caption text, post_date date,
  like_count int, comment_count int, created_at timestamptz, updated_at timestamptz,
  user_id uuid, username text, display_name text, avatar_url text, media jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.day_number, p.caption, p.post_date,
         p.like_count, p.comment_count, p.created_at, p.updated_at,
         pr.id, pr.username, pr.display_name, pr.avatar_url,
         public.duel_post_media_json(p.id)
    from public.challenge_posts p
    join public.profiles pr on pr.id = p.user_id
   where p.challenge_id = p_challenge_id
   order by p.day_number asc, p.created_at asc;
$$;

-- Recent media-carrying posts (kept for API compatibility with older clients).
create or replace function public.get_explore_posts(p_limit int default 50)
returns table (
  post_id uuid, challenge_id uuid, challenge_title text,
  day_number int, caption text, post_date date,
  like_count int, comment_count int, created_at timestamptz,
  user_id uuid, username text, display_name text, avatar_url text, media jsonb
)
language sql stable security definer set search_path = public as $$
  select p.id, p.challenge_id, c.title, p.day_number, p.caption, p.post_date,
         p.like_count, p.comment_count, p.created_at,
         pr.id, pr.username, pr.display_name, pr.avatar_url,
         public.duel_post_media_json(p.id)
    from public.challenge_posts p
    join public.profiles pr on pr.id = p.user_id
    join public.challenges c on c.id = p.challenge_id
   where exists (select 1 from public.challenge_post_media m where m.post_id = p.id)
   order by p.created_at desc
   limit least(coalesce(p_limit, 50), 100);
$$;

-- A user's daily posts — profile content grid. Same row shape as duel_feed().
create or replace function public.get_user_posts(p_user uuid, p_limit int default 60)
returns table (
  post_id uuid, challenge_id uuid, challenge_title text, duration_days int,
  category_id text, category_name text, category_emoji text,
  author_id uuid, author_name text, author_username text, author_avatar text,
  day_number int, checkin_date date, note text,
  media_url text, media_type text, media jsonb,
  created_at timestamptz, like_count int, comment_count int,
  my_liked boolean, is_mine boolean
)
language sql stable security definer set search_path = public as $$
  with viewer as (select public.duel_current_profile_id() as id),
  rows as (
    select p.id, p.challenge_id, p.user_id, p.day_number, p.post_date, p.caption,
           p.like_count, p.comment_count, p.created_at,
           c.title as ch_title, c.duration_days as ch_days,
           cat.name as cat_name, cat.emoji as cat_emoji,
           pr.display_name, pr.username, pr.avatar_url,
           public.duel_post_media_json(p.id) as media
      from public.challenge_posts p
      join public.challenges c on c.id = p.challenge_id
      join public.duel_categories cat on cat.id = c.category_id
      join public.profiles pr on pr.id = p.user_id
     where p.user_id = p_user
     order by p.created_at desc
     limit least(coalesce(p_limit, 60), 200)
  )
  select r.id, r.challenge_id, r.ch_title, r.ch_days,
         (select c2.category_id from public.challenges c2 where c2.id = r.challenge_id),
         r.cat_name, r.cat_emoji,
         r.user_id, r.display_name, r.username, r.avatar_url,
         r.day_number, r.post_date, r.caption,
         r.media->0->>'url', r.media->0->>'type', r.media,
         r.created_at, r.like_count, r.comment_count,
         exists (select 1 from public.challenge_post_likes l
                  where l.post_id = r.id and l.user_id = (select id from viewer)) as my_liked,
         (r.user_id = (select id from viewer)) as is_mine
    from rows r;
$$;

-- ============================================================================
-- 7. MESSAGING — membership privacy, bookkeeping triggers, 1-to-1 open
-- ============================================================================

create or replace function public.duel_fn_message_touch() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_other uuid;
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;

  for v_other in
    select user_id from public.conversation_participants
     where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    insert into public.notifications (user_id, actor_id, kind, conversation_id, body)
    values (v_other, new.sender_id, 'message', new.conversation_id, left(new.content, 140));
  end loop;

  return new;
end;
$$;

-- Consolidated bookkeeping: retire the older notify-only trigger to avoid
-- duplicate notifications.
drop trigger if exists trg_duel_notify_message on public.messages;
drop trigger if exists trg_messages_touch on public.messages;
drop function if exists public.duel_fn_notify_message();
create trigger trg_messages_touch after insert on public.messages
  for each row execute function public.duel_fn_message_touch();

/** Opens (or reuses) a strict 1-to-1 conversation and returns its id. */
create or replace function public.duel_open_conversation(p_other_user uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me    uuid := public.duel_current_profile_id();
  convo uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if me = p_other_user then raise exception 'cannot message yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then
    raise exception 'that member does not exist';
  end if;

  select cp.conversation_id into convo
    from public.conversation_participants cp
   where cp.user_id = me
     and exists (select 1 from public.conversation_participants o
                  where o.conversation_id = cp.conversation_id and o.user_id = p_other_user)
     and (select count(*) from public.conversation_participants x
           where x.conversation_id = cp.conversation_id) = 2
   order by cp.joined_at
   limit 1;

  if convo is null then
    insert into public.conversations (last_message_at) values (null) returning id into convo;
    insert into public.conversation_participants (conversation_id, user_id)
    values (convo, me), (convo, p_other_user);
  end if;

  return convo;
end;
$$;

-- Guard triggers: lock rows down to the fields each side may touch.
create or replace function public.duel_fn_notifications_guard() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id
     or new.actor_id is distinct from old.actor_id
     or new.kind <> old.kind
     or new.challenge_id is distinct from old.challenge_id
     or new.conversation_id is distinct from old.conversation_id
     or new.body is distinct from old.body
     or new.created_at <> old.created_at then
    raise exception 'only the read flag may be updated on notifications';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notifications_guard on public.notifications;
create trigger trg_notifications_guard before update on public.notifications
  for each row execute function public.duel_fn_notifications_guard();

create or replace function public.duel_fn_participant_guard() returns trigger
language plpgsql as $$
begin
  if new.conversation_id <> old.conversation_id or new.user_id <> old.user_id
     or new.joined_at <> old.joined_at then
    raise exception 'only last_read_at may be updated on conversation participants';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_participant_guard on public.conversation_participants;
create trigger trg_participant_guard before update on public.conversation_participants
  for each row execute function public.duel_fn_participant_guard();

create or replace function public.duel_fn_profile_guard() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.user_id is distinct from old.user_id then
    raise exception 'protected profile fields cannot be changed';
  end if;
  if new.verified is distinct from old.verified then
    raise exception 'the verified badge is managed by the platform';
  end if;
  if new.is_persona is distinct from old.is_persona then
    raise exception 'the persona flag is managed by the platform';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profile_guard on public.profiles;
create trigger trg_profile_guard before update on public.profiles
  for each row execute function public.duel_fn_profile_guard();

-- ============================================================================
-- 8. ROW LEVEL SECURITY — explicit policy set for every table
-- ============================================================================

alter table public.profiles                  enable row level security;
alter table public.user_settings             enable row level security;
alter table public.duel_categories           enable row level security;
alter table public.challenges                enable row level security;
alter table public.challenge_participants    enable row level security;
alter table public.challenge_posts           enable row level security;
alter table public.challenge_post_media      enable row level security;
alter table public.challenge_post_likes      enable row level security;
alter table public.challenge_post_comments   enable row level security;
alter table public.challenge_checkins        enable row level security;
alter table public.challenge_likes           enable row level security;
alter table public.challenge_saves           enable row level security;
alter table public.challenge_shares          enable row level security;
alter table public.challenge_comments        enable row level security;
alter table public.activities                enable row level security;
alter table public.searches                  enable row level security;
alter table public.user_category_affinity    enable row level security;
alter table public.recommendations           enable row level security;
alter table public.user_keywords             enable row level security;
alter table public.notifications             enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.app_settings              enable row level security;

-- ---- profiles: public profile info readable; only the owner writes ----
create policy profiles_select on public.profiles
  for select using (true);
create policy profiles_insert_self on public.profiles
  for insert with check (user_id = auth.uid() and verified = false and is_persona = false);
create policy profiles_update_self on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid() and verified = false);
create policy profiles_delete_self on public.profiles
  for delete using (user_id = auth.uid());

-- ---- user_settings: strictly private ----
create policy user_settings_select on public.user_settings
  for select using (user_id = public.duel_current_profile_id());
create policy user_settings_insert on public.user_settings
  for insert with check (user_id = public.duel_current_profile_id());
create policy user_settings_update on public.user_settings
  for update using (user_id = public.duel_current_profile_id())
  with check (user_id = public.duel_current_profile_id());
create policy user_settings_delete on public.user_settings
  for delete using (user_id = public.duel_current_profile_id());

-- ---- categories: public taxonomy, platform-managed ----
create policy categories_select on public.duel_categories
  for select using (true);

-- ---- challenges: public read; creator-only writes ----
create policy challenges_select on public.challenges
  for select using (true);
create policy challenges_insert on public.challenges
  for insert with check (creator_id = public.duel_current_profile_id());
create policy challenges_update on public.challenges
  for update using (creator_id = public.duel_current_profile_id())
  with check (creator_id = public.duel_current_profile_id());
create policy challenges_delete on public.challenges
  for delete using (creator_id = public.duel_current_profile_id());

-- ---- participants: public read; join as self; leave (non-completed) as self.
--      Progress fields (streaks, completion) are engine-maintained via the
--      SECURITY DEFINER recompute — no client UPDATE policy on purpose, so a
--      user can never forge their own streak. ----
create policy participants_select on public.challenge_participants
  for select using (true);
create policy participants_insert on public.challenge_participants
  for insert with check (user_id = public.duel_current_profile_id());
create policy participants_delete on public.challenge_participants
  for delete using (user_id = public.duel_current_profile_id() and status <> 'completed');

-- ---- daily posts: public read; author-only writes; parent participation
--      verified on insert (defence in depth around the rules trigger) ----
create policy posts_select on public.challenge_posts
  for select using (true);
create policy posts_insert on public.challenge_posts
  for insert with check (
    user_id = public.duel_current_profile_id()
    and exists (select 1 from public.challenge_participants p
                 where p.challenge_id = challenge_posts.challenge_id
                   and p.user_id = public.duel_current_profile_id())
  );
create policy posts_update on public.challenge_posts
  for update using (user_id = public.duel_current_profile_id())
  with check (user_id = public.duel_current_profile_id());
create policy posts_delete on public.challenge_posts
  for delete using (user_id = public.duel_current_profile_id());

-- ---- post media: public read; writes only through the owning post ----
create policy post_media_select on public.challenge_post_media
  for select using (true);
create policy post_media_insert on public.challenge_post_media
  for insert with check (
    exists (select 1 from public.challenge_posts p
             where p.id = challenge_post_media.post_id
               and p.user_id = public.duel_current_profile_id())
  );
create policy post_media_update on public.challenge_post_media
  for update using (
    exists (select 1 from public.challenge_posts p
             where p.id = challenge_post_media.post_id
               and p.user_id = public.duel_current_profile_id())
  ) with check (
    exists (select 1 from public.challenge_posts p
             where p.id = challenge_post_media.post_id
               and p.user_id = public.duel_current_profile_id())
  );
create policy post_media_delete on public.challenge_post_media
  for delete using (
    exists (select 1 from public.challenge_posts p
             where p.id = challenge_post_media.post_id
               and p.user_id = public.duel_current_profile_id())
  );

-- ---- post likes / comments: interactions are self-only ----
create policy post_likes_select on public.challenge_post_likes
  for select using (true);
create policy post_likes_insert on public.challenge_post_likes
  for insert with check (user_id = public.duel_current_profile_id());
create policy post_likes_delete on public.challenge_post_likes
  for delete using (user_id = public.duel_current_profile_id());

create policy post_comments_select on public.challenge_post_comments
  for select using (true);
create policy post_comments_insert on public.challenge_post_comments
  for insert with check (user_id = public.duel_current_profile_id());
create policy post_comments_delete on public.challenge_post_comments
  for delete using (user_id = public.duel_current_profile_id());

-- ---- check-in ledger: readable, but ONLY the trigger projection writes it ----
create policy checkins_select on public.challenge_checkins
  for select using (true);
-- (no INSERT/UPDATE/DELETE policies on purpose: content lives in challenge_posts)

-- ---- challenge likes / saves / shares / comments: self-only interactions ----
create policy likes_select on public.challenge_likes for select using (true);
create policy likes_insert on public.challenge_likes
  for insert with check (user_id = public.duel_current_profile_id());
create policy likes_delete on public.challenge_likes
  for delete using (user_id = public.duel_current_profile_id());

create policy saves_select on public.challenge_saves for select using (true);
create policy saves_insert on public.challenge_saves
  for insert with check (user_id = public.duel_current_profile_id());
create policy saves_delete on public.challenge_saves
  for delete using (user_id = public.duel_current_profile_id());

create policy shares_select on public.challenge_shares for select using (true);
create policy shares_insert on public.challenge_shares
  for insert with check (user_id = public.duel_current_profile_id());

create policy challenge_comments_select on public.challenge_comments for select using (true);
create policy challenge_comments_insert on public.challenge_comments
  for insert with check (user_id = public.duel_current_profile_id());
create policy challenge_comments_delete on public.challenge_comments
  for delete using (user_id = public.duel_current_profile_id());

-- ---- behaviour data & derived ranking: strictly private ----
create policy activities_select on public.activities
  for select using (user_id = public.duel_current_profile_id());
create policy activities_insert on public.activities
  for insert with check (user_id = public.duel_current_profile_id());

create policy searches_select on public.searches
  for select using (user_id = public.duel_current_profile_id());
create policy searches_insert on public.searches
  for insert with check (user_id = public.duel_current_profile_id());

create policy affinity_select on public.user_category_affinity
  for select using (user_id = public.duel_current_profile_id());

create policy recommendations_select on public.recommendations
  for select using (user_id = public.duel_current_profile_id());

create policy user_keywords_select on public.user_keywords
  for select using (user_id = public.duel_current_profile_id());
create policy user_keywords_insert on public.user_keywords
  for insert with check (user_id = public.duel_current_profile_id());
create policy user_keywords_update on public.user_keywords
  for update using (user_id = public.duel_current_profile_id())
  with check (user_id = public.duel_current_profile_id());
create policy user_keywords_delete on public.user_keywords
  for delete using (user_id = public.duel_current_profile_id());

-- ---- notifications: private to the recipient; only `read` changes (guard) ----
create policy notifications_select on public.notifications
  for select using (user_id = public.duel_current_profile_id());
create policy notifications_update on public.notifications
  for update using (user_id = public.duel_current_profile_id())
  with check (user_id = public.duel_current_profile_id());
-- (no insert/delete for clients: notifications are trigger-created)

-- ---- messaging: participants only, everywhere ----
-- Membership checks go through a SECURITY DEFINER helper so policies can
-- reference conversation membership without recursing into themselves.
create or replace function public.duel_is_conversation_member(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
     where conversation_id = p_conversation
       and user_id = public.duel_current_profile_id()
  );
$$;

create policy conversations_select on public.conversations
  for select using (public.duel_is_conversation_member(conversations.id));
-- (no client insert/update/delete: threads are created via duel_open_conversation)

create policy conversation_participants_select on public.conversation_participants
  for select using (public.duel_is_conversation_member(conversation_participants.conversation_id));
create policy conversation_participants_update on public.conversation_participants
  for update using (user_id = public.duel_current_profile_id())
  with check (user_id = public.duel_current_profile_id());
create policy conversation_participants_delete on public.conversation_participants
  for delete using (user_id = public.duel_current_profile_id());
-- (no client insert: memberships are created by duel_open_conversation — a user
--  must never be able to add themselves to someone else's conversation)

create policy messages_select on public.messages
  for select using (public.duel_is_conversation_member(messages.conversation_id));
create policy messages_insert on public.messages
  for insert with check (
    sender_id = public.duel_current_profile_id()
    and public.duel_is_conversation_member(messages.conversation_id)
  );
create policy messages_delete on public.messages
  for delete using (sender_id = public.duel_current_profile_id());
-- (no update: messages are immutable once sent)

-- ---- app_settings: platform-managed weights, no client access ----
-- (RLS enabled, zero policies = deny)

-- ============================================================================
-- 9. SUPABASE STORAGE — buckets + object RLS mirroring DB ownership
-- ============================================================================
-- Path scheme (both buckets):
--   {auth.uid()}/{kind}/{yyyy-mm}/{uuid}.{ext}
-- The first folder IS the uploader's auth.uid(), so "own folder only" policies
-- give exactly the ownership model of the database. `duel-media` is public-read
-- (challenge posts, covers, avatars are public content); `duel-chat` is private
-- and additionally readable by the uploader's conversation partners.

do $$
begin
  if to_regclass('storage.buckets') is not null then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'duel-media', 'duel-media', true, 314572800,
      array['image/jpeg','image/jpg','image/png','image/gif','image/webp',
            'video/mp4','video/quicktime','video/webm','video/x-m4v','video/ogg']
    )
    on conflict (id) do update
       set public = true,
           file_size_limit = excluded.file_size_limit,
           allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'duel-chat', 'duel-chat', false, 12582912,
      array['image/jpeg','image/jpg','image/png','image/gif','image/webp']
    )
    on conflict (id) do update
       set public = false,
           file_size_limit = excluded.file_size_limit,
           allowed_mime_types = excluded.allowed_mime_types;

    -- Reset object policies we manage, then restate the audited set.
    execute $policies$
      do $inner$
      declare r record;
      begin
        for r in select policyname from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname like 'duel %'
        loop
          execute format('drop policy %I on storage.objects', r.policyname);
        end loop;
      end $inner$;
    $policies$;

    -- duel-media: world-readable, owner-folder writes
    -- key convention: {kind}/{user_id}/{yyyy-mm}/{file}  → foldername[2] = uid
    execute $policies$
      create policy "duel media select" on storage.objects
        for select using (bucket_id = 'duel-media');
      create policy "duel media insert" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'duel-media'
          and (storage.foldername(name))[2] = auth.uid()::text
        );
      create policy "duel media update" on storage.objects
        for update to authenticated
        using (bucket_id = 'duel-media' and (storage.foldername(name))[2] = auth.uid()::text)
        with check (bucket_id = 'duel-media' and (storage.foldername(name))[2] = auth.uid()::text);
      create policy "duel media delete" on storage.objects
        for delete to authenticated
        using (bucket_id = 'duel-media' and (storage.foldername(name))[2] = auth.uid()::text);
    $policies$;

    -- duel-chat: owner + conversation partners may read; owner writes
    execute $policies$
      create policy "duel chat select" on storage.objects
        for select to authenticated
        using (
          bucket_id = 'duel-chat'
          and (
            (storage.foldername(name))[2] = auth.uid()::text
            or exists (
              select 1
                from public.profiles p
                join public.conversation_participants mine
                  on mine.user_id = public.duel_current_profile_id()
                join public.conversation_participants theirs
                  on theirs.conversation_id = mine.conversation_id
                 and theirs.user_id = p.id
               where p.user_id::text = (storage.foldername(name))[2]
            )
          )
        );
      create policy "duel chat insert" on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'duel-chat'
          and (storage.foldername(name))[2] = auth.uid()::text
        );
      create policy "duel chat update" on storage.objects
        for update to authenticated
        using (bucket_id = 'duel-chat' and (storage.foldername(name))[2] = auth.uid()::text)
        with check (bucket_id = 'duel-chat' and (storage.foldername(name))[2] = auth.uid()::text);
      create policy "duel chat delete" on storage.objects
        for delete to authenticated
        using (bucket_id = 'duel-chat' and (storage.foldername(name))[2] = auth.uid()::text);
    $policies$;

  end if;
end $$;

-- ============================================================================
-- 10. REALTIME + CLOSING
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object or undefined_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object or undefined_object then null; end $$;

commit;

notify pgrst, 'reload schema';

-- ============================================================================
-- DONE. Relationship map:
--
--   profiles ─┬─ challenges ─ challenge_participants ─ challenge_posts ─ challenge_post_media
--             │                                                      └─ challenge_post_likes / _comments
--             │               challenge_checkins (derived ledger, trigger-maintained)
--             ├─ conversations ─ conversation_participants ─ messages
--             └─ user_settings (private)
--
-- Storage: duel-media (public read) / duel-chat (participant read),
--          both with owner-folder-only INSERT/UPDATE/DELETE.
-- ============================================================================
