-- ============================================================================*

-- DUEL — PLATFORM MIGRATION  (RUHIZ → DUEL)*

-- ============================================================================*

-- Run AFTER inspecting your data with supabase/duel/INSPECT_BEFORE_MIGRATION.sql*

--*

-- This migration is IDEMPOTENT: safe to re-run at any time.*

--*

-- WHAT IT DOES*

--   1. PRESERVES  auth.users, profiles (real accounts + personas),*

--      conversations / conversation_participants / messages (chat survives).*

--   2. REMOVES    every RUHIZ-specific artifact: posts, post_problems*

--      (keyword classification), post_supports, post_saves, been_there,*

--      comments, problems (mental-health taxonomy), activities +*

--      user_problem_scores (old recommendation state), supporters, blocks,*

--      old notifications, and the classifier / counter triggers & functions.*

--   3. CREATES    the DUEL schema: duel_categories, challenges,*

--      challenge_participants, challenge_checkins, challenge_likes,*

--      challenge_saves, challenge_shares, challenge_comments, activities,*

--      searches, user_category_affinity, recommendations, notifications.*

--   4. ENFORCES   counters, streaks and completion via triggers so concurrent*

--      clients can never corrupt them.*

--   5. REPLACES   the old SQL recommendation system with duel_track() +*

--      duel_refresh_recommendations() + duel_recommend(): behaviour-driven*

--      scoring (views/joins/check-ins/completions/likes/saves/shares/*

--      comments/searches) with diversity caps and a balanced cold start.*

--   6. SECURES    everything with Row Level Security + indexes.*

--   7. SEEDS      10 categories, community personas and 18 starter challenges.*

-- ============================================================================*

begin;

create extension if not exists "pgcrypto";

-- ============================================================================*

-- 0. BASE OBJECTS (makes this migration self-sufficient on a FRESH database;*

--    on an existing install every statement below is a no-op)*

-- ============================================================================*

create table if not exists public.profiles (

  id           uuid primary key default gen_random_uuid(),

  user_id      uuid references auth.users(id) on delete cascade,

  username     text,

  display_name text,

  avatar_url   text,

  cover_url    text,

  avatar_hue   int  not null default 152,

  bio          text not null default '',

  location     text not null default '',

  website      text not null default '',

  verified     boolean not null default false,

  is_persona   boolean not null default false,

  settings     jsonb not null default '{}'::jsonb,

  last_seen_at timestamptz,

  created_at   timestamptz not null default now(),

  updated_at   timestamptz not null default now()

);

create unique index if not exists idx_profiles_user_id on public.profiles (user_id) where user_id is not null;

create unique index if not exists idx_profiles_username on public.profiles (lower(username)) where username is not null;

create table if not exists public.conversations (

  id              uuid primary key default gen_random_uuid(),

  last_message_at timestamptz,

  created_at      timestamptz not null default now()

);

create table if not exists public.conversation_participants (

  conversation_id uuid not null references public.conversations(id) on delete cascade,

  user_id         uuid not null references public.profiles(id) on delete cascade,

  joined_at       timestamptz not null default now(),

  last_read_at    timestamptz not null default now(),

  primary key (conversation_id, user_id)

);

create table if not exists public.messages (

  id              uuid primary key default gen_random_uuid(),

  conversation_id uuid not null references public.conversations(id) on delete cascade,

  sender_id       uuid not null references public.profiles(id) on delete cascade,

  content         text not null check (char_length(content) between 1 and 2000),

  created_at      timestamptz not null default now()

);

create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at);

-- keep display profiles in sync with auth signups*

create or replace function public.handle_new_user() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  base text;

  candidate text;

  n int := 0;

begin

  base := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'duelist');

  base := regexp_replace(base, '[^a-zA-Z0-9_]', '', 'g');

  if char_length(base) < 3 then base := 'duelist'; end if;

  candidate := base;

  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop

    n := n + 1;

    candidate := left(base, 16) || n::text;

  end loop;

  insert into public.profiles (user_id, username, display_name)

  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', candidate))

  on conflict (user_id) do nothing;

  return new;

end;

$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created after insert on auth.users

  for each row execute function public.handle_new_user();

-- ============================================================================*

-- 1. SAFE REMOVAL OF RUHIZ ARTIFACTS*

--    (auth.users and profiles are never touched here)*

-- ============================================================================*

-- triggers first, then functions, then tables*

drop trigger if exists trg_classify_post       on public.posts;

drop trigger if exists trg_support_count       on public.post_supports;

drop trigger if exists trg_comment_count       on public.comments;

drop trigger if exists trg_save_count          on public.post_saves;

drop trigger if exists trg_beenthere_count     on public.been_there;

drop trigger if exists trg_activities_scores   on public.activities;

drop trigger if exists trg_notify_support      on public.post_supports;

drop trigger if exists trg_notify_comment      on public.comments;

drop trigger if exists trg_notify_message      on public.messages;

drop trigger if exists trg_notify_mention      on public.posts;

drop function if exists public.fn_classify_post() cascade;

drop function if exists public.fn_classify_text(text, text[]) cascade;

drop function if exists public.fn_bump_counter() cascade;

drop function if exists public.get_user_problem_scores() cascade;

drop function if exists public.fn_notify_support() cascade;

drop function if exists public.fn_notify_comment() cascade;

drop function if exists public.fn_notify_message() cascade;

drop table if exists public.post_problems      cascade;

drop table if exists public.post_supports      cascade;

drop table if exists public.post_saves         cascade;

drop table if exists public.been_there         cascade;

drop table if exists public.comments           cascade;

drop table if exists public.posts              cascade;

drop table if exists public.problems           cascade;

drop table if exists public.activities         cascade;

drop table if exists public.user_problem_scores cascade;

drop table if exists public.supporters         cascade;

drop table if exists public.blocks             cascade;

drop table if exists public.notifications      cascade;

-- ============================================================================*

-- 2. DUEL SCHEMA*

-- ============================================================================*

create table if not exists public.duel_categories (

  id       text primary key,

  name     text not null,

  emoji    text not null default '•',

  color    text not null default '#16e08a',

  tagline  text not null default '',

  sort     int  not null default 0

);

create table if not exists public.challenges (

  id                uuid primary key default gen_random_uuid(),

  creator_id        uuid not null references public.profiles(id) on delete cascade,

  title             text not null check (char_length(title) between 4 and 80),

  description       text not null default '' check (char_length(description) <= 2000),

  category_id       text not null references public.duel_categories(id) on delete restrict,

  duration_days     int  not null check (duration_days between 1 and 365),

  difficulty        text not null default 'medium' check (difficulty in ('easy','medium','hard')),

  daily_task        text not null default '' check (char_length(daily_task) <= 300),

  cover_url         text,

  tags              text[] not null default '{}',

  status            text not null default 'open' check (status in ('open','closed','archived')),

  participant_count int  not null default 0,

  like_count        int  not null default 0,

  comment_count     int  not null default 0,

  save_count        int  not null default 0,

  share_count       int  not null default 0,

  view_count        int  not null default 0,

  completion_count  int  not null default 0,

  created_at        timestamptz not null default now(),

  updated_at        timestamptz not null default now()

);

create table if not exists public.challenge_participants (

  challenge_id      uuid not null references public.challenges(id) on delete cascade,

  user_id           uuid not null references public.profiles(id) on delete cascade,

  status            text not null default 'active' check (status in ('active','completed','abandoned')),

  joined_at         timestamptz not null default now(),

  current_streak    int  not null default 0,

  longest_streak    int  not null default 0,

  completed_days    int  not null default 0,

  last_checkin_date date,

  completed_at      timestamptz,

  primary key (challenge_id, user_id)

);

create table if not exists public.challenge_checkins (

  id           uuid primary key default gen_random_uuid(),

  challenge_id uuid not null references public.challenges(id) on delete cascade,

  user_id      uuid not null references public.profiles(id) on delete cascade,

  day_number   int  not null check (day_number between 1 and 365),

  checkin_date date not null default current_date,

  note         text not null default '' check (char_length(note) <= 2000),

  media_url    text,

  media_type   text check (media_type in ('image', 'video')),

  created_at   timestamptz not null default now(),

  unique (challenge_id, user_id, day_number),

  unique (challenge_id, user_id, checkin_date)

);

alter table public.challenge_checkins add column if not exists media_url text;

alter table public.challenge_checkins add column if not exists media_type text check (media_type in ('image', 'video'));

create table if not exists public.challenge_likes (

  challenge_id uuid not null references public.challenges(id) on delete cascade,

  user_id      uuid not null references public.profiles(id) on delete cascade,

  created_at   timestamptz not null default now(),

  primary key (challenge_id, user_id)

);

create table if not exists public.challenge_saves (

  challenge_id uuid not null references public.challenges(id) on delete cascade,

  user_id      uuid not null references public.profiles(id) on delete cascade,

  created_at   timestamptz not null default now(),

  primary key (challenge_id, user_id)

);

create table if not exists public.challenge_shares (

  id           uuid primary key default gen_random_uuid(),

  challenge_id uuid not null references public.challenges(id) on delete cascade,

  user_id      uuid not null references public.profiles(id) on delete cascade,

  created_at   timestamptz not null default now()

);

create table if not exists public.challenge_comments (

  id           uuid primary key default gen_random_uuid(),

  challenge_id uuid not null references public.challenges(id) on delete cascade,

  user_id      uuid not null references public.profiles(id) on delete cascade,

  body         text not null check (char_length(body) between 1 and 1000),

  created_at   timestamptz not null default now()

);

/** Behaviour events feeding the DUEL recommendation engine. */

create table if not exists public.activities (

  id           uuid primary key default gen_random_uuid(),

  user_id      uuid not null references public.profiles(id) on delete cascade,

  action       text not null check (action in

                 ('view','join','leave','checkin','complete','like','comment','save','share','search','create','not_interested')),

  challenge_id uuid references public.challenges(id) on delete set null,

  category_id  text references public.duel_categories(id) on delete set null,

  bucket       text check (bucket in ('sprint','short','classic','marathon')),

  query        text,

  created_at   timestamptz not null default now()

);

create table if not exists public.searches (

  id         uuid primary key default gen_random_uuid(),

  user_id    uuid not null references public.profiles(id) on delete cascade,

  query      text not null check (char_length(query) between 1 and 120),

  created_at timestamptz not null default now()

);

/** Per-user category affinity maintained by duel_track(). */

create table if not exists public.user_category_affinity (

  user_id      uuid not null references public.profiles(id) on delete cascade,

  category_id  text not null references public.duel_categories(id) on delete cascade,

  score        double precision not null default 0,

  interactions int not null default 0,

  bucket_sprint   double precision not null default 0,

  bucket_short    double precision not null default 0,

  bucket_classic  double precision not null default 0,

  bucket_marathon double precision not null default 0,

  updated_at   timestamptz not null default now(),

  primary key (user_id, category_id)

);

/** Materialised ranking written by duel_refresh_recommendations(). */

create table if not exists public.recommendations (

  user_id      uuid not null references public.profiles(id) on delete cascade,

  challenge_id uuid not null references public.challenges(id) on delete cascade,

  score        double precision not null default 0,

  reason       text not null default '',

  generated_at timestamptz not null default now(),

  primary key (user_id, challenge_id)

);

create table if not exists public.notifications (

  id              uuid primary key default gen_random_uuid(),

  user_id         uuid not null references public.profiles(id) on delete cascade,

  actor_id        uuid references public.profiles(id) on delete set null,

  kind            text not null check (kind in

                    ('like','comment','join','complete','checkin','mention','message','streak','system')),

  challenge_id    uuid references public.challenges(id) on delete set null,

  conversation_id uuid references public.conversations(id) on delete set null,

  body            text,

  read            boolean not null default false,

  created_at      timestamptz not null default now()

);

-- recommendation weights (mirrors lib/duel/recommend.ts ACTION_WEIGHTS)*

create table if not exists public.app_settings (

  key        text primary key,

  value      jsonb not null,

  updated_at timestamptz not null default now()

);

insert into public.app_settings (key, value) values

  ('duel_recsys_weights', '{

     "view": 1, "like": 3, "save": 4, "comment": 3, "join": 6, "checkin": 2,

     "complete": 8, "share": 3, "search": 2.5, "create": 4, "leave": -3, "not_interested": -9

   }'::jsonb)

on conflict (key) do update set value = excluded.value;

-- ============================================================================*

-- 3. INDEXES*

-- ============================================================================*

create index if not exists idx_challenges_category   on public.challenges (category_id);

create index if not exists idx_challenges_created    on public.challenges (created_at desc);

create index if not exists idx_challenges_popularity on public.challenges (participant_count desc, like_count desc);

create index if not exists idx_challenges_tags       on public.challenges using gin (tags);

create index if not exists idx_challenges_status     on public.challenges (status) where status = 'open';

create index if not exists idx_participants_user     on public.challenge_participants (user_id, status);

create index if not exists idx_checkins_user_date    on public.challenge_checkins (user_id, checkin_date desc);

create index if not exists idx_checkins_challenge    on public.challenge_checkins (challenge_id, day_number);

create index if not exists idx_likes_user            on public.challenge_likes (user_id);

create index if not exists idx_saves_user            on public.challenge_saves (user_id);

create index if not exists idx_shares_challenge      on public.challenge_shares (challenge_id);

create index if not exists idx_comments_challenge    on public.challenge_comments (challenge_id, created_at);

create index if not exists idx_activities_user_time  on public.activities (user_id, created_at desc);

create index if not exists idx_activities_category   on public.activities (category_id) where category_id is not null;

create index if not exists idx_searches_user         on public.searches (user_id, created_at desc);

create index if not exists idx_affinity_user         on public.user_category_affinity (user_id, score desc);

create index if not exists idx_recommendations_user  on public.recommendations (user_id, score desc);

create index if not exists idx_notifications_user    on public.notifications (user_id, created_at desc) where read = false;

-- updated_at bookkeeping*

create or replace function public.handle_updated_at() returns trigger as $$

begin

  new.updated_at = now();

  return new;

end;

$$ language plpgsql;

drop trigger if exists trg_challenges_updated_at on public.challenges;

create trigger trg_challenges_updated_at before update on public.challenges

  for each row execute function public.handle_updated_at();

-- ============================================================================*

-- 4. HELPERS, COUNTERS, STREAKS*

-- ============================================================================*

create or replace function public.duel_current_profile_id() returns uuid

language sql stable security definer set search_path = public as $$

  select id from public.profiles where user_id = auth.uid() limit 1;

$$;

/** Generic counter maintenance for challenge denormalised counts. */

create or replace function public.duel_fn_bump_counter() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  col text;

  delta int;

begin

  col := tg_argv[0];

  if tg_op = 'INSERT' then delta := 1; elsif tg_op = 'DELETE' then delta := -1; else return null; end if;

  if tg_op = 'DELETE' then

    execute format('update public.challenges set %I = greatest(0, %I + $1) where id = $2', col, col)

      using delta, old.challenge_id;

    return old;

  else

    execute format('update public.challenges set %I = greatest(0, %I + $1) where id = $2', col, col)

      using delta, new.challenge_id;

    return new;

  end if;

end;

$$;

drop trigger if exists trg_duel_like_count on public.challenge_likes;

create trigger trg_duel_like_count after insert or delete on public.challenge_likes

  for each row execute function public.duel_fn_bump_counter('like_count');

drop trigger if exists trg_duel_save_count on public.challenge_saves;

create trigger trg_duel_save_count after insert or delete on public.challenge_saves

  for each row execute function public.duel_fn_bump_counter('save_count');

drop trigger if exists trg_duel_comment_count on public.challenge_comments;

create trigger trg_duel_comment_count after insert or delete on public.challenge_comments

  for each row execute function public.duel_fn_bump_counter('comment_count');

drop trigger if exists trg_duel_share_count on public.challenge_shares;

create trigger trg_duel_share_count after insert on public.challenge_shares

  for each row execute function public.duel_fn_bump_counter('share_count');

drop trigger if exists trg_duel_participant_count on public.challenge_participants;

create trigger trg_duel_participant_count after insert or delete on public.challenge_participants

  for each row execute function public.duel_fn_bump_counter('participant_count');

/**

 * Check-in engine: maintains completed_days, streaks, completion state and

 * emits streak / completion notifications. Runs instead of a plain insert so

 * the maths is atomic and impossible to drift.

 */

create or replace function public.duel_fn_apply_checkin() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  part       public.challenge_participants%rowtype;

  ch         public.challenges%rowtype;

  milestone  int;

begin

  select * into ch from public.challenges where id = new.challenge_id;

  if not found then raise exception 'challenge not found'; end if;

  select * into part from public.challenge_participants

   where challenge_id = new.challenge_id and user_id = new.user_id;

  if not found then raise exception 'join the challenge before checking in'; end if;

  if part.status <> 'active' then raise exception 'this challenge is already completed'; end if;

  if part.last_checkin_date = new.checkin_date then raise exception 'already checked in today'; end if;

  if part.last_checkin_date = (new.checkin_date - interval '1 day')::date then

    part.current_streak := part.current_streak + 1;

  else

    part.current_streak := 1;

  end if;

  part.longest_streak  := greatest(part.longest_streak, part.current_streak);

  part.completed_days  := part.completed_days + 1;

  part.last_checkin_date := new.checkin_date;

  if part.completed_days >= ch.duration_days then

    part.status := 'completed';

    part.completed_at := now();

    update public.challenges set completion_count = completion_count + 1 where id = ch.id;

    insert into public.notifications (user_id, actor_id, kind, challenge_id, body)

      values (new.user_id, null, 'streak', ch.id,

              format('Challenge complete: %s. %s days, done. Badge earned.', ch.title, ch.duration_days));

    insert into public.notifications (user_id, actor_id, kind, challenge_id, body)

      select ch.creator_id, new.user_id, 'complete', ch.id,

             format('%s completed your challenge %s', p.display_name, ch.title)

        from public.profiles p where p.id = new.user_id;

  else

    milestone := part.current_streak;

    if milestone in (3,7,14,21,30,50,100) then

      insert into public.notifications (user_id, actor_id, kind, challenge_id, body)

        values (new.user_id, null, 'streak', ch.id,

                format('%s-day streak on %s. Do not break the chain.', milestone, ch.title));

    end if;

  end if;

  update public.challenge_participants

     set status = part.status,

         current_streak = part.current_streak,

         longest_streak = part.longest_streak,

         completed_days = part.completed_days,

         last_checkin_date = part.last_checkin_date,

         completed_at = part.completed_at

   where challenge_id = part.challenge_id and user_id = part.user_id;

  perform public.duel_track('checkin', ch.id, ch.category_id,

            case when ch.duration_days <= 7 then 'sprint'

                 when ch.duration_days <= 14 then 'short'

                 when ch.duration_days <= 30 then 'classic'

                 else 'marathon' end, null);

  return new;

end;

$$;

drop trigger if exists trg_duel_apply_checkin on public.challenge_checkins;

create trigger trg_duel_apply_checkin before insert on public.challenge_checkins

  for each row execute function public.duel_fn_apply_checkin();

/** Server-side check-in entry point used by the app (returns fresh state). */

create or replace function public.duel_checkin(
  p_challenge_id uuid,
  p_note text default '',
  p_media_url text default null,
  p_media_type text default null,
  p_day_number int default null
)

returns jsonb

language plpgsql security definer set search_path = public as $$

declare

  me    uuid := public.duel_current_profile_id();

  part  public.challenge_participants%rowtype;

  ck    public.challenge_checkins%rowtype;

  target_day int;

begin

  if me is null then raise exception 'not signed in'; end if;

  if p_day_number is not null then
    target_day := p_day_number;
  else
    select coalesce(max(day_number), 0) + 1 into target_day
      from public.challenge_checkins
     where challenge_id = p_challenge_id and user_id = me;
  end if;

  insert into public.challenge_checkins (challenge_id, user_id, day_number, checkin_date, note, media_url, media_type)
  values (p_challenge_id, me, target_day, current_date, coalesce(p_note, ''), p_media_url, p_media_type)
  on conflict (challenge_id, user_id, day_number) do update set
    note = coalesce(excluded.note, challenge_checkins.note),
    media_url = coalesce(excluded.media_url, challenge_checkins.media_url),
    media_type = coalesce(excluded.media_type, challenge_checkins.media_type)
  returning * into ck;

  select * into part from public.challenge_participants

   where challenge_id = p_challenge_id and user_id = me;

  return jsonb_build_object(

    'checkin', jsonb_build_object('id', ck.id, 'challenge_id', ck.challenge_id, 'day_number', ck.day_number,

                                  'checkin_date', ck.checkin_date, 'note', ck.note,
                                  'media_url', ck.media_url, 'media_type', ck.media_type,

                                  'created_at', ck.created_at),

    'participation', jsonb_build_object('challenge_id', part.challenge_id, 'status', part.status,

                                        'joined_at', part.joined_at, 'current_streak', part.current_streak,

                                        'longest_streak', part.longest_streak, 'completed_days', part.completed_days,

                                        'last_checkin_date', part.last_checkin_date, 'completed_at', part.completed_at)

  );

end;

$$;

-- ============================================================================*

-- 5. RECOMMENDATION SYSTEM (behaviour-driven, diverse, cold-start safe)*

-- ============================================================================*

create or replace function public.app_settings_value(p_key text) returns jsonb

language sql stable security definer set search_path = public as $$

  select value from public.app_settings where key = p_key;

$$;

/** Records a behaviour event and updates category affinity in one call. */

create or replace function public.duel_track(

  p_action text, p_challenge_id uuid default null, p_category_id text default null,

  p_bucket text default null, p_query text default null)

returns void

language plpgsql security definer set search_path = public as $$

declare

  me     uuid := public.duel_current_profile_id();

  w      double precision;

  cat    text := p_category_id;

  bkt    text := p_bucket;

  ch     public.challenges%rowtype;

begin

  if me is null then return; end if;

  if p_challenge_id is not null then

    select * into ch from public.challenges where id = p_challenge_id;

    cat := coalesce(cat, ch.category_id);

    bkt := coalesce(bkt, case when ch.duration_days <= 7 then 'sprint'

                              when ch.duration_days <= 14 then 'short'

                              when ch.duration_days <= 30 then 'classic'

                              else 'marathon' end);

  end if;

  insert into public.activities (user_id, action, challenge_id, category_id, bucket, query)

  values (me, p_action, p_challenge_id, cat, bkt, p_query);

  if p_action = 'search' and p_query is not null then

    insert into public.searches (user_id, query) values (me, p_query);

-- search intent boosts matching categories*

    update public.user_category_affinity a

       set score = a.score + 2.5, interactions = a.interactions + 1, updated_at = now()

      from public.duel_categories c

     where a.user_id = me and a.category_id = c.id

       and (position(lower(c.name) in lower(p_query)) > 0 or position(lower(p_query) in lower(c.name)) > 0);

    return;

  end if;

  w := coalesce((public.app_settings_value('duel_recsys_weights')->>p_action)::double precision, 0);

  if cat is null then return; end if;

  insert into public.user_category_affinity

       (user_id, category_id, score, interactions, bucket_sprint, bucket_short, bucket_classic, bucket_marathon)

  values (me, cat, w, 1,

          case when bkt = 'sprint' then w else 0 end,

          case when bkt = 'short' then w else 0 end,

          case when bkt = 'classic' then w else 0 end,

          case when bkt = 'marathon' then w else 0 end)

  on conflict (user_id, category_id) do update

     set score = greatest(-50, user_category_affinity.score + w),

         interactions = user_category_affinity.interactions + 1,

         bucket_sprint = user_category_affinity.bucket_sprint + case when bkt = 'sprint' then w else 0 end,

         bucket_short = user_category_affinity.bucket_short + case when bkt = 'short' then w else 0 end,

         bucket_classic = user_category_affinity.bucket_classic + case when bkt = 'classic' then w else 0 end,

         bucket_marathon = user_category_affinity.bucket_marathon + case when bkt = 'marathon' then w else 0 end,

         updated_at = now();

  perform public.duel_refresh_recommendations(me);

end;

$$;

/**

 * Recomputes a user's ranked challenge list from real behaviour:

 *   36% category affinity · 12% duration-bucket fit · 30% popularity

 *   10% engagement rate · 12% freshness, plus a stable per-user jitter.

 * Joined / completed / dismissed challenges are excluded.

 */

create or replace function public.duel_refresh_recommendations(p_user uuid)

returns void

language plpgsql security definer set search_path = public as $$

declare

  interactions int;

  max_pop double precision;

  max_eng double precision;

  max_aff double precision;

  max_bkt double precision;

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

  delete from public.recommendations where user_id = p_user;

  insert into public.recommendations (user_id, challenge_id, score, reason)

  select p_user, c.id,

         ( 0.36 * greatest(0, coalesce(a.score, 0)) / max_aff

         + 0.12 * greatest(0, case

                when c.duration_days <= 7  then coalesce(a.bucket_sprint, 0)

                when c.duration_days <= 14 then coalesce(a.bucket_short, 0)

                when c.duration_days <= 30 then coalesce(a.bucket_classic, 0)

                else coalesce(a.bucket_marathon, 0) end) / max_bkt

         + 0.30 * ln(1 + c.participant_count + c.like_count * 2 + c.save_count) / max_pop

         + 0.10 * ((c.like_count + c.save_count * 1.2 + c.share_count * 1.5 + c.comment_count) / greatest(1, c.view_count + 1)) / max_eng

         + 0.12 * exp(-extract(epoch from (now() - c.created_at)) / 86400.0 / 45.0)

         ) * 100

         + (hashtext(p_user::text || c.id::text) % 1000) / 500.0,

         case

           when interactions = 0 then

             case when c.participant_count > 1500 then 'Popular this week in ' || cat.name

                  else 'Staff pick in ' || cat.name end

           when coalesce(a.score, 0) > 0 and joined.t is not null then 'Because you joined ' || joined.t

           when coalesce(a.score, 0) > 0 then 'You keep exploring ' || cat.name

           when c.participant_count > 1500 then 'Trending in ' || cat.name

           else 'Fresh in ' || cat.name

         end

    from public.challenges c

    join public.duel_categories cat on cat.id = c.category_id

    left join public.user_category_affinity a on a.user_id = p_user and a.category_id = c.category_id

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

/** Diverse read of the materialised ranking: max 3 per category per page. */

create or replace function public.duel_recommend(p_limit int default 12)

returns table (challenge_id uuid, score double precision, reason text)

language sql stable security definer set search_path = public as $$

  select r.challenge_id, r.score, r.reason

    from (select r.*, row_number() over (partition by c.category_id order by r.score desc) rn

            from public.recommendations r

            join public.challenges c on c.id = r.challenge_id

           where r.user_id = public.duel_current_profile_id()) r

   where r.rn <= 3

   order by r.score desc

   limit p_limit;

$$;

/** Full-text-ish search over challenges, tags, categories and people. */

create or replace function public.duel_search(p_query text)

returns table (challenge uuid, title text, category text, people uuid)

language sql stable security definer set search_path = public as $$

  select c.id, c.title, c.category_id, null::uuid

    from public.challenges c

   where c.status = 'open'

     and (c.title ilike '%' || p_query || '%' or c.description ilike '%' || p_query || '%'

          or exists (select 1 from unnest(c.tags) t where t ilike '%' || p_query || '%')

          or exists (select 1 from public.duel_categories cat where cat.id = c.category_id and cat.name ilike '%' || p_query || '%'))

  union all

  select null, p.display_name, null, p.id

    from public.profiles p

   where p.display_name ilike '%' || p_query || '%' or p.username ilike '%' || p_query || '%';

$$;

/** Opens (or reuses) a 1-to-1 conversation and returns its id. */

create or replace function public.duel_open_conversation(p_other_user uuid)

returns uuid

language plpgsql security definer set search_path = public as $$

declare

  me    uuid := public.duel_current_profile_id();

  convo uuid;

begin

  if me is null then raise exception 'not signed in'; end if;

  if me = p_other_user then raise exception 'cannot message yourself'; end if;

  select cp.conversation_id into convo

    from public.conversation_participants cp

    join public.conversation_participants cp2 on cp2.conversation_id = cp.conversation_id

   where cp.user_id = me and cp2.user_id = p_other_user

   limit 1;

  if convo is null then

    insert into public.conversations (last_message_at) values (null) returning id into convo;

    insert into public.conversation_participants (conversation_id, user_id) values (convo, me), (convo, p_other_user);

  end if;

  return convo;

end;

$$;

-- ============================================================================*

-- 6. NOTIFICATION TRIGGERS*

-- ============================================================================*

create or replace function public.duel_fn_notify_social() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  ch   public.challenges%rowtype;

  actor public.profiles%rowtype;

  kind text := tg_argv[0];

begin

  select * into ch from public.challenges where id = new.challenge_id;

  if not found then return new; end if;

  if ch.creator_id = new.user_id then return new; end if;

  select * into actor from public.profiles where id = new.user_id;

  insert into public.notifications (user_id, actor_id, kind, challenge_id, body)

  values (ch.creator_id, new.user_id, kind, ch.id,

          case kind

            when 'like'    then format('%s liked your challenge %s', actor.display_name, ch.title)

            when 'comment' then format('%s commented on %s', actor.display_name, ch.title)

            when 'join'    then format('%s joined your challenge %s', actor.display_name, ch.title)

            else format('%s interacted with %s', actor.display_name, ch.title)

          end);

  return new;

end;

$$;

drop trigger if exists trg_duel_notify_like on public.challenge_likes;

create trigger trg_duel_notify_like after insert on public.challenge_likes

  for each row execute function public.duel_fn_notify_social('like');

drop trigger if exists trg_duel_notify_comment on public.challenge_comments;

create trigger trg_duel_notify_comment after insert on public.challenge_comments

  for each row execute function public.duel_fn_notify_social('comment');

drop trigger if exists trg_duel_notify_join on public.challenge_participants;

create trigger trg_duel_notify_join after insert on public.challenge_participants

  for each row execute function public.duel_fn_notify_social('join');

create or replace function public.duel_fn_notify_message() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  other uuid;

begin

  select cp.user_id into other

    from public.conversation_participants cp

   where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id

   limit 1;

  if other is null then return new; end if;

  insert into public.notifications (user_id, actor_id, kind, conversation_id, body)

  values (other, new.sender_id, 'message', new.conversation_id, left(new.content, 120));

  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;

  return new;

end;

$$;

drop trigger if exists trg_duel_notify_message on public.messages;

create trigger trg_duel_notify_message after insert on public.messages

  for each row execute function public.duel_fn_notify_message();

-- ============================================================================*

-- 7. ROW LEVEL SECURITY*

-- ============================================================================*

alter table public.duel_categories          enable row level security;

alter table public.challenges               enable row level security;

alter table public.challenge_participants   enable row level security;

alter table public.challenge_checkins       enable row level security;

alter table public.challenge_likes          enable row level security;

alter table public.challenge_saves          enable row level security;

alter table public.challenge_shares         enable row level security;

alter table public.challenge_comments       enable row level security;

alter table public.activities               enable row level security;

alter table public.searches                 enable row level security;

alter table public.user_category_affinity   enable row level security;

alter table public.recommendations          enable row level security;

alter table public.notifications            enable row level security;

-- categories: public read*

drop policy if exists categories_read on public.duel_categories;

create policy categories_read on public.duel_categories for select using (true);

-- challenges: everyone reads; owners write*

drop policy if exists challenges_read on public.challenges;

create policy challenges_read on public.challenges for select using (true);

drop policy if exists challenges_insert on public.challenges;

create policy challenges_insert on public.challenges for insert

  with check (creator_id = public.duel_current_profile_id());

drop policy if exists challenges_update on public.challenges;

create policy challenges_update on public.challenges for update

  using (creator_id = public.duel_current_profile_id());

drop policy if exists challenges_delete on public.challenges;

create policy challenges_delete on public.challenges for delete

  using (creator_id = public.duel_current_profile_id());

-- participants: public read; self insert; self leave (non-completed)*

drop policy if exists participants_read on public.challenge_participants;

create policy participants_read on public.challenge_participants for select using (true);

drop policy if exists participants_insert on public.challenge_participants;

create policy participants_insert on public.challenge_participants for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists participants_delete on public.challenge_participants;

create policy participants_delete on public.challenge_participants for delete

  using (user_id = public.duel_current_profile_id() and status <> 'completed');

drop policy if exists participants_update on public.challenge_participants;

create policy participants_update on public.challenge_participants for update

  using (user_id = public.duel_current_profile_id());

-- checkins: public read; self insert (trigger enforces rules); self delete*

drop policy if exists checkins_read on public.challenge_checkins;

create policy checkins_read on public.challenge_checkins for select using (true);

drop policy if exists checkins_insert on public.challenge_checkins;

create policy checkins_insert on public.challenge_checkins for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists checkins_delete on public.challenge_checkins;

create policy checkins_delete on public.challenge_checkins for delete

  using (user_id = public.duel_current_profile_id());

drop policy if exists checkins_update on public.challenge_checkins;

create policy checkins_update on public.challenge_checkins for update

  using (user_id = public.duel_current_profile_id());

-- likes / saves / shares / comments*

drop policy if exists likes_read on public.challenge_likes;

create policy likes_read on public.challenge_likes for select using (true);

drop policy if exists likes_write on public.challenge_likes;

create policy likes_write on public.challenge_likes for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists likes_delete on public.challenge_likes;

create policy likes_delete on public.challenge_likes for delete

  using (user_id = public.duel_current_profile_id());

drop policy if exists saves_read on public.challenge_saves;

create policy saves_read on public.challenge_saves for select using (true);

drop policy if exists saves_write on public.challenge_saves;

create policy saves_write on public.challenge_saves for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists saves_delete on public.challenge_saves;

create policy saves_delete on public.challenge_saves for delete

  using (user_id = public.duel_current_profile_id());

drop policy if exists shares_read on public.challenge_shares;

create policy shares_read on public.challenge_shares for select using (true);

drop policy if exists shares_write on public.challenge_shares;

create policy shares_write on public.challenge_shares for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists comments_read on public.challenge_comments;

create policy comments_read on public.challenge_comments for select using (true);

drop policy if exists comments_insert on public.challenge_comments;

create policy comments_insert on public.challenge_comments for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists comments_delete on public.challenge_comments;

create policy comments_delete on public.challenge_comments for delete

  using (user_id = public.duel_current_profile_id());

-- behaviour data: strictly private*

drop policy if exists activities_own on public.activities;

create policy activities_own on public.activities for select using (user_id = public.duel_current_profile_id());

drop policy if exists activities_insert on public.activities;

create policy activities_insert on public.activities for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists searches_own on public.searches;

create policy searches_own on public.searches for select using (user_id = public.duel_current_profile_id());

drop policy if exists searches_insert on public.searches;

create policy searches_insert on public.searches for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists affinity_own on public.user_category_affinity;

create policy affinity_own on public.user_category_affinity for select using (user_id = public.duel_current_profile_id());

drop policy if exists recommendations_own on public.recommendations;

create policy recommendations_own on public.recommendations for select using (user_id = public.duel_current_profile_id());

-- notifications: private, owner can mark read*

drop policy if exists notifications_own on public.notifications;

create policy notifications_own on public.notifications for select using (user_id = public.duel_current_profile_id());

drop policy if exists notifications_update on public.notifications;

create policy notifications_update on public.notifications for update

  using (user_id = public.duel_current_profile_id());

-- profiles: readable by everyone, self-service updates (kept from RUHIZ auth)*

drop policy if exists profiles_read on public.profiles;

create policy profiles_read on public.profiles for select using (true);

drop policy if exists profiles_insert_self on public.profiles;

create policy profiles_insert_self on public.profiles for insert

  with check (user_id = auth.uid() or user_id is null);

drop policy if exists profiles_update_self on public.profiles;

create policy profiles_update_self on public.profiles for update

  using (user_id = auth.uid() or id = public.duel_current_profile_id());

-- conversations / messages: participants only (re-stated idempotently)*

drop policy if exists conversations_own on public.conversations;

create policy conversations_own on public.conversations for select

  using (exists (select 1 from public.conversation_participants cp

                  where cp.conversation_id = conversations.id and cp.user_id = public.duel_current_profile_id()));

drop policy if exists conversation_participants_own on public.conversation_participants;

create policy conversation_participants_own on public.conversation_participants for select

  using (true);

drop policy if exists conversation_participants_insert on public.conversation_participants;

create policy conversation_participants_insert on public.conversation_participants for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists conversation_participants_update on public.conversation_participants;

create policy conversation_participants_update on public.conversation_participants for update

  using (user_id = public.duel_current_profile_id());

drop policy if exists messages_read on public.messages;

create policy messages_read on public.messages for select

  using (exists (select 1 from public.conversation_participants cp

                  where cp.conversation_id = messages.conversation_id

                    and cp.user_id = public.duel_current_profile_id()));

drop policy if exists messages_insert on public.messages;

create policy messages_insert on public.messages for insert

  with check (sender_id = public.duel_current_profile_id()

              and exists (select 1 from public.conversation_participants cp

                           where cp.conversation_id = messages.conversation_id

                             and cp.user_id = public.duel_current_profile_id()));

-- ============================================================================*

-- 8. REALTIME*

-- ============================================================================*

do $$

begin

  alter publication supabase_realtime add table public.notifications;

exception when duplicate_object then null; end $$;

do $$

begin

  alter publication supabase_realtime add table public.messages;

exception when duplicate_object then null; end $$;

-- ============================================================================*

-- 9. SEED: categories, personas, starter challenges*

-- ============================================================================*

insert into public.duel_categories (id, name, emoji, color, tagline, sort) values

  ('coding',      'Coding & Building',     '💻', '#22d3ee', 'Ship something every day', 1),

  ('fitness',     'Fitness & Movement',    '🏋️', '#f97316', 'Stronger, faster, further', 2),

  ('reading',     'Reading & Learning',    '📚', '#a78bfa', 'Pages turn into perspective', 3),

  ('detox',       'Digital Detox',         '📵', '#f43f5e', 'Reclaim your attention', 4),

  ('mindfulness', 'Mindfulness & Focus',   '🧘', '#34d399', 'Train the muscle between your ears', 5),

  ('nutrition',   'Nutrition & Sleep',     '🥗', '#84cc16', 'Fuel and recovery done right', 6),

  ('creativity',  'Creativity & Craft',    '🎨', '#f472b6', 'Make things, badly then brilliantly', 7),

  ('finance',     'Money & Discipline',    '💰', '#facc15', 'Small daily wins, compounding', 8),

  ('language',    'Languages',             '🗣️', '#60a5fa', 'Ten words a day adds up', 9),

  ('outdoors',    'Outdoors & Adventure',  '⛰️', '#2dd4bf', 'Get outside, every single day', 10)

on conflict (id) do update

   set name = excluded.name, emoji = excluded.emoji, color = excluded.color,

       tagline = excluded.tagline, sort = excluded.sort;

-- Real users create real challenges on DUEL. No fake personas or demo posts are seeded.

commit;

-- PostgREST schema cache reload so the new tables appear immediately*

notify pgrst, 'reload schema';

-- ============================================================================*

-- DONE. Verify with:*

--   select table_name from information_schema.tables*

--    where table_schema = 'public' order by 1;*

--   select count(*) from public.challenges;         -- 18*

--   select count(*) from public.duel_categories;    -- 10*

-- ============================================================================*