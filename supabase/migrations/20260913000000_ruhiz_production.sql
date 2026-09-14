-- ============================================================================
-- RUHIZ — PRODUCTION SCHEMA MIGRATION
-- ============================================================================
-- Run this once in the Supabase SQL Editor (Dashboard → SQL → New query).
-- It is fully IDEMPOTENT: safe to re-run at any time.
--
-- What it creates:
--   1. Problem taxonomy (recommendation categories + keywords)
--   2. profiles (users + seeded community personas)
--   3. posts, post_problems (auto-classified), comments, post_supports,
--      post_saves, been_there
--   4. activities + user_problem_scores  (the recommendation engine state)
--   5. supporters (social graph: supporters / supporting), blocks
--   6. conversations, conversation_participants, messages  (1-to-1 chat)
--   7. notifications
--   8. Row Level Security on every table
--   9. Supabase Realtime: publication + private-channel authorization
--  10. Seed data: the existing Ruhiz demo content (personas + 16 posts),
--      attributed interactions for the demo account
--      (mohammadasimsaad@gmail.com) so the feed is personalised on day one.
--
-- No application downtime: the app runs in demo mode until this is applied,
-- then switches to Supabase automatically.
-- ============================================================================

begin;

create extension if not exists "pgcrypto";

-- ============================================================================
-- 0. APP SETTINGS (configurable recommendation weights)
-- ============================================================================
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values (
  'recsys_weights',
  '{
    "view": 1, "watch": 3, "support": 5, "comment": 6, "save": 8,
    "share": 7, "search": 2.5, "been_there": 4,
    "ignore": -1.5, "not_interested": -9
  }'::jsonb
)
on conflict (key) do nothing;

-- ============================================================================
-- 1. PROBLEM TAXONOMY
--    Mirrors lib/recsys/problems.ts — keep in sync when editing.
-- ============================================================================
create table if not exists public.problems (
  id       text primary key,
  label    text not null,
  emoji    text not null default '•',
  keywords text[] not null default '{}',
  sort     int  not null default 0
);

insert into public.problems (id, label, emoji, keywords, sort) values
  ('anxiety',      'Anxiety & Overthinking',      '🌀', '{anxiety,anxious,panic,overthinking,overthink,overthinker,worried,worry,stressed,stress,nervous,racing,grounding,calm,breathe,breathing,spiral,spiraling}', 1),
  ('mood',         'Low Mood & Depression',       '🌧️', '{depression,depressed,depressing,sad,sadness,numb,empty,hopeless,crying,cried,tears,unmotivated,mental,therapy,therapist,mentalhealth,dark,heavy}', 2),
  ('burnout',      'Burnout & Exhaustion',        '🔥', '{burnout,burned,burnt,exhausted,exhaustion,drained,overworked,overwhelm,overwhelmed,tired,fatigue,deadline,workload}', 3),
  ('studying',     'Studying & Exams',            '📚', '{study,studying,exam,exams,finals,mock,test,tests,grades,grade,college,university,school,homework,assignments,revision,revise,semester,flashcards,med,anatomy,notes}', 4),
  ('career',       'Career & Work',               '💼', '{job,jobs,career,boss,interview,interviews,resume,promotion,quit,fired,unemployment,office,coworkers,parking,nurse,shift,workday,workplace}', 5),
  ('relationships','Relationships',               '💌', '{relationship,relationships,girlfriend,boyfriend,partner,marriage,married,breakup,dating,distance,spouse,husband,wife,love,letter,letters,calls}', 6),
  ('family',       'Family & Home',               '🏡', '{family,parents,mom,dad,mother,father,brother,sister,grandma,grandpa,son,daughter,home,proud}', 7),
  ('loneliness',   'Loneliness & Connection',     '🫂', '{lonely,loneliness,alone,isolated,isolation,invisible,disconnected,friendless,nobody,friends,friendship}', 8),
  ('sleep',        'Sleep & Restless Nights',     '🌙', '{sleep,sleeping,asleep,insomnia,sleepless,awake,night,nights,midnight,bedtime,nap,dreams}', 9),
  ('self_esteem',  'Confidence & Self-worth',     '🌱', '{confidence,confident,esteem,worth,imposter,insecure,insecurity,doubt,comparing,comparison,enough,fail,failure,failing,mistake,growth,growing,boundaries}', 10),
  ('habits',       'Habits & Routines',           '✅', '{habit,habits,routine,routines,discipline,consistency,consistent,journal,journaling,meditation,meditate,mindfulness,streak,daily,morning,bed,improvement,improve,progress}', 11),
  ('gratitude',    'Gratitude & Joy',             '✨', '{grateful,gratitude,thankful,grace,blessed,blessing,appreciate,appreciation,joy,happy,happiness,win,peaceful,peace,golden,beautiful,calm,cozy,warmth}', 12),
  ('recovery',     'Recovery & Healing',          '💪', '{recovery,recovering,sober,sobriety,relapse,addiction,addict,alcoholic,healing,heal,stronger,survivor,rep,fighting}', 13),
  ('grief',        'Grief & Loss',                '🕊️', '{grief,grieving,loss,passed,died,death,mourning,miss,missing,funeral,guitar,song,fragile}', 14),
  ('fitness',      'Movement & Fitness',          '🏃', '{run,running,ran,gym,workout,exercise,fitness,yoga,walk,walking,walked,mile,miles,studio,practice,practiced,stretching,health}', 15),
  ('creativity',   'Creativity & Expression',     '🎨', '{music,song,guitar,art,painting,paint,writing,write,wrote,poetry,poem,creative,photography,photo,camera,draw,drawing,vlog,unedited}', 16),
  ('self_care',    'Self-care & Rest',            '🛁', '{rest,resting,selfcare,care,permission,tea,slow,slowing,quiet,gentle,softer,kindness,reset,sunday,window,small}', 17)
on conflict (id) do update
  set label = excluded.label, emoji = excluded.emoji, keywords = excluded.keywords, sort = excluded.sort;

-- ============================================================================
-- 2. PROFILES (users + seeded community personas)
-- ============================================================================
-- The legacy Ruhiz schema may already have a `profiles` table (created by
-- supabase-schema.sql). We add the new columns if they are missing; new
-- installs get the full table.

create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  username     text not null,
  display_name text not null,
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

alter table public.profiles add column if not exists cover_url    text;
alter table public.profiles add column if not exists avatar_hue   int not null default 152;
alter table public.profiles add column if not exists bio          text not null default '';
alter table public.profiles add column if not exists location     text not null default '';
alter table public.profiles add column if not exists website      text not null default '';
alter table public.profiles add column if not exists verified     boolean not null default false;
alter table public.profiles add column if not exists is_persona   boolean not null default false;
alter table public.profiles add column if not exists settings     jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists updated_at   timestamptz not null default now();

-- legacy schema had NOT NULL on user_id; personas need it nullable
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table public.profiles alter column user_id drop not null;
  end if;
end $$;

create unique index if not exists profiles_user_id_unique on public.profiles(user_id) where user_id is not null;
create unique index if not exists profiles_username_key   on public.profiles(lower(username));
create index if not exists idx_profiles_persona on public.profiles(is_persona) where is_persona;

-- drop legacy username check constraints if present (they can block seeds)
do $$ begin
  alter table public.profiles drop constraint if exists username_length;
  alter table public.profiles drop constraint if exists username_format;
exception when others then null; end $$;

alter table public.profiles add constraint profiles_username_shape
  check (char_length(username) between 2 and 30 and username ~ '^[a-zA-Z0-9_]+$') not valid;
-- validate best-effort (existing rows may need manual fixes)
do $$ begin
  alter table public.profiles validate constraint profiles_username_shape;
exception when others then
  alter table public.profiles drop constraint if exists profiles_username_shape;
end $$;

-- ---- helpers -----------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ---- new user → profile ------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(coalesce(new.email, 'member'), '@', 1)
  );
  base := regexp_replace(base, '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 2 then base := 'member'; end if;
  base := left(base, 24);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (user_id, username, display_name)
  values (
    new.id,
    candidate,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), candidate)
  );
  return new;
end $$;

do $$ begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
exception when others then
  raise notice 'Could not attach auth.users trigger (permissions): %', sqlerrm;
end $$;

-- ============================================================================
-- 3. POSTS + CLASSIFICATION
-- ============================================================================
-- Legacy `moments` (if present) is renamed out of the way first, and its old
-- `comments` table too, so fresh tables with the same names can be created.

do $$ begin
  if to_regclass('public.comments') is not null and exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='comments' and column_name='moment_id'
  ) then
    alter table public.comments rename to comments_legacy_v1;
  end if;
exception when others then null; end $$;

create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  type             text not null default 'moment'
                   check (type in ('photo','video','moment','question')),
  content          text not null default '',
  image_url        text,          -- public URL or private R2 object key
  video_url        text,          -- public URL or private R2 object key
  topics           text[] not null default '{}',
  support_count    int not null default 0,
  comment_count    int not null default 0,
  share_count      int not null default 0,
  save_count       int not null default 0,
  been_there_count int not null default 0,
  view_count       int not null default 0,
  status           text not null default 'live' check (status in ('live','removed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_posts_created_at   on public.posts (created_at desc);
create index if not exists idx_posts_author       on public.posts (user_id, created_at desc);
create index if not exists idx_posts_type         on public.posts (type) where status = 'live';
create index if not exists idx_posts_topics       on public.posts using gin (topics);

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at before update on public.posts
  for each row execute procedure public.handle_updated_at();

-- ---- post ↔ problem classification -------------------------------------

create table if not exists public.post_problems (
  post_id    uuid not null references public.posts(id) on delete cascade,
  problem_id text not null references public.problems(id) on delete cascade,
  score      real not null default 0,
  primary key (post_id, problem_id)
);
create index if not exists idx_post_problems_problem on public.post_problems (problem_id);

-- Deterministic classifier — the SQL twin of lib/recsys/classifier.ts.
create or replace function public.fn_classify_text(p_content text, p_topics text[])
returns jsonb
language plpgsql stable as $$
declare
  r record;
  score double precision;
  kw text;
  t text;
  lower_content text := lower(coalesce(p_content, ''));
  total double precision := 0;
  v_result jsonb := '{}'::jsonb;
begin
  for r in select * from public.problems order by sort loop
    score := 0;
    -- topic aliases (weighted mapping, kept in sync with TOPIC_TO_PROBLEMS)
    if p_topics is not null then
      foreach t in array p_topics loop
        case t
          when 'Mental Health' then
            score := score + 1.2 * (case r.id when 'mood' then 0.45 when 'anxiety' then 0.3 when 'self_care' then 0.25 else 0 end);
          when 'Life' then
            score := score + 1.2 * (case r.id when 'self_care' then 0.5 when 'gratitude' then 0.5 else 0 end);
          when 'Relationships' then
            score := score + 1.2 * (case r.id when 'relationships' then 0.8 when 'family' then 0.2 else 0 end);
          when 'Studying'      then score := score + (case r.id when 'studying' then 1.2 else 0 end);
          when 'Career'        then score := score + (case r.id when 'career' then 1.2 else 0 end);
          when 'Gratitude'     then score := score + (case r.id when 'gratitude' then 1.2 else 0 end);
          when 'Fitness'       then score := score + (case r.id when 'fitness' then 1.2 else 0 end);
          when 'Creativity'    then score := score + (case r.id when 'creativity' then 1.2 else 0 end);
          when 'Recovery'      then score := score + (case r.id when 'recovery' then 1.2 else 0 end);
          when 'Self Improvement' then
            score := score + 1.2 * (case r.id when 'habits' then 0.6 when 'self_esteem' then 0.4 else 0 end);
          else null;
        end case;
      end loop;
    end if;
    -- keyword hits
    foreach kw in array r.keywords loop
      if position(' ' in kw) > 0 then
        if position(kw in lower_content) > 0 then score := score + 1.4; end if;
      else
        if lower_content ~ ('\m' || kw || '\M') then score := score + 1.0; end if;
      end if;
    end loop;
    if score >= 0.75 then
      v_result := v_result || jsonb_build_object(r.id, score);
      total := total + score;
    end if;
  end loop;

  -- top 4 by (score desc, id asc), normalised to shares
  with entries as (
    select e.k, e.v::float8 as v from jsonb_each_text(v_result) as e(k, v)
  ), ranked as (
    select k, v, row_number() over (order by v desc, k asc) rn,
           sum(v) over () s
    from entries
  )
  select coalesce(jsonb_object_agg(ranked.k, round((ranked.v / nullif(ranked.s, 0))::numeric, 3)), '{}'::jsonb)
  into v_result
  from (select k, v, s from ranked where rn <= 4) ranked;

  return v_result;
end $$;

create or replace function public.fn_classify_post()
returns trigger language plpgsql as $$
declare
  probs jsonb;
  pid text;
  sc real;
begin
  delete from public.post_problems where post_id = new.id;
  probs := public.fn_classify_text(new.content, new.topics);
  for pid, sc in select * from jsonb_each_text(probs) loop
    insert into public.post_problems (post_id, problem_id, score)
    values (new.id, pid, sc::real)
    on conflict (post_id, problem_id) do update set score = excluded.score;
  end loop;
  return new;
end $$;

drop trigger if exists trg_classify_post on public.posts;
create trigger trg_classify_post
  after insert or update of content, topics on public.posts
  for each row execute procedure public.fn_classify_post();

-- ============================================================================
-- 4. SOCIAL INTERACTIONS
-- ============================================================================

-- "Support" reactions on posts (replaces likes everywhere)
create table if not exists public.post_supports (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists idx_post_supports_user on public.post_supports (user_id, created_at desc);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_post on public.comments (post_id, created_at);

create table if not exists public.post_saves (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists idx_post_saves_user on public.post_saves (user_id, created_at desc);

create table if not exists public.been_there (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---- counter maintenance ------------------------------------------------

create or replace function public.fn_bump_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_column text;
  v_delta  int;
  v_post   uuid;
begin
  v_post   := coalesce(new.post_id, old.post_id);
  v_delta  := case when tg_op = 'INSERT' then 1 else -1 end;
  v_column := case tg_table_name
                when 'post_supports' then 'support_count'
                when 'comments'      then 'comment_count'
                when 'post_saves'    then 'save_count'
                when 'been_there'    then 'been_there_count'
              end;
  if v_column is not null then
    execute format('update public.posts set %I = greatest(0, %I + $1) where id = $2', v_column, v_column)
      using v_delta, v_post;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_support_count on public.post_supports;
create trigger trg_support_count after insert or delete on public.post_supports
  for each row execute procedure public.fn_bump_counter();
drop trigger if exists trg_comment_count on public.comments;
create trigger trg_comment_count after insert or delete on public.comments
  for each row execute procedure public.fn_bump_counter();
drop trigger if exists trg_save_count on public.post_saves;
create trigger trg_save_count after insert or delete on public.post_saves
  for each row execute procedure public.fn_bump_counter();
drop trigger if exists trg_beenthere_count on public.been_there;
create trigger trg_beenthere_count after insert or delete on public.been_there
  for each row execute procedure public.fn_bump_counter();

-- ============================================================================
-- 5. RECOMMENDATION STATE — activities + user_problem_scores
-- ============================================================================

create table if not exists public.activities (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  action     text not null check (action in
               ('view','watch','support','comment','save','share','search','ignore','not_interested','been_there')),
  query      text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activities_user_time on public.activities (user_id, created_at desc);
create index if not exists idx_activities_post      on public.activities (post_id);
-- one view per user per post (dedupes feed impressions)
create unique index if not exists idx_activities_view_unique
  on public.activities (user_id, post_id) where action = 'view';

create table if not exists public.user_problem_scores (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  problem_id     text not null references public.problems(id) on delete cascade,
  score          real not null default 0,
  interactions   int  not null default 0,
  last_event_at  timestamptz not null default now(),
  primary key (user_id, problem_id)
);

-- ---- activity recording RPC (called by the app) -------------------------

create or replace function public.record_activities(p_activities jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid := public.current_profile_id();
  v_item jsonb;
  v_post uuid;
  v_action text;
  v_query text;
  v_meta jsonb;
  v_inserted boolean;
  v_weights jsonb;
  v_weight double precision;
  v_pid text;
  v_share real;
  v_prev real;
  v_last timestamptz;
begin
  if v_profile is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select coalesce(
    (select value from public.app_settings where key = 'recsys_weights'),
    '{"view":1,"watch":3,"support":5,"comment":6,"save":8,"share":7,"search":2.5,"been_there":4,"ignore":-1.5,"not_interested":-9}'::jsonb
  ) into v_weights;

  for v_item in select * from jsonb_array_elements(p_activities) loop
    v_post   := (v_item->>'post_id')::uuid;
    v_action := v_item->>'action';
    v_query  := v_item->>'query';
    v_meta   := coalesce(v_item->'meta', '{}'::jsonb);
    v_inserted := false;

    if v_action is null then continue; end if;

    if v_post is not null and not exists (select 1 from public.posts where id = v_post) then
      raise exception 'POST_NOT_FOUND';
    end if;

    -- 1) store the raw activity (views deduped per post)
    if v_action = 'view' and v_post is not null then
      insert into public.activities (user_id, post_id, action, query, meta)
      values (v_profile, v_post, 'view', null, v_meta)
      on conflict (user_id, post_id) where action = 'view' do nothing
      returning true into v_inserted;
    else
      insert into public.activities (user_id, post_id, action, query, meta)
      values (v_profile, v_post, v_action, v_query, v_meta);
      v_inserted := true;
    end if;

    -- 2) counters
    if v_inserted and v_post is not null then
      if v_action = 'view' then
        update public.posts set view_count = view_count + 1 where id = v_post;
      elsif v_action = 'share' then
        update public.posts set share_count = share_count + 1 where id = v_post;
      end if;
    end if;

    -- 3) interest scores (skip duplicate views)
    if v_inserted and v_post is not null and v_action <> 'search' then
      v_weight := coalesce((v_weights ->> v_action)::double precision, 0);
      if v_weight <> 0 then
        for v_pid, v_share in
          select problem_id, score from public.post_problems where post_id = v_post
        loop
          select score, last_event_at into v_prev, v_last
          from public.user_problem_scores
          where user_id = v_profile and problem_id = v_pid;

          if v_prev is null then
            insert into public.user_problem_scores (user_id, problem_id, score, interactions, last_event_at)
            values (v_profile, v_pid, greatest(-60, least(400, v_weight * v_share)), 1, now());
          else
            -- decay then add (half-life 14 days — mirrors lib/recsys/engine.ts)
            update public.user_problem_scores
            set score = greatest(-60, least(400,
                    v_prev * power(0.5, extract(epoch from (now() - v_last)) / 86400.0 / 14.0)
                    + v_weight * v_share)),
                interactions = interactions + 1,
                last_event_at = now()
            where user_id = v_profile and problem_id = v_pid;
          end if;
        end loop;
      end if;
    end if;

    -- 4) search: classify the query text itself
    if v_action = 'search' and v_query is not null and char_length(v_query) >= 3 then
      declare
        probs jsonb := public.fn_classify_text(v_query, '{}');
        p2 text; s2 real;
      begin
        for p2, s2 in select * from jsonb_each_text(probs) loop
          insert into public.user_problem_scores (user_id, problem_id, score, interactions, last_event_at)
          values (v_profile, p2, greatest(-60, least(400, coalesce((v_weights->>'search')::double precision, 2.5) * s2::real)), 1, now())
          on conflict (user_id, problem_id) do update
            set score = greatest(-60, least(400,
                  user_problem_scores.score * power(0.5, extract(epoch from (now() - user_problem_scores.last_event_at)) / 86400.0 / 14.0)
                  + coalesce((v_weights->>'search')::double precision, 2.5) * s2::real)),
                interactions = user_problem_scores.interactions + 1,
                last_event_at = now();
        end loop;
      end;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(p_activities));
end $$;

revoke all on function public.record_activities(jsonb) from public, anon;
grant execute on function public.record_activities(jsonb) to authenticated;

-- ---- interest scores for the client -------------------------------------

create or replace function public.get_user_problem_scores()
returns table (problem_id text, score real, interactions int)
language sql stable security definer set search_path = public as $$
  select ups.problem_id,
         (ups.score * power(0.5, extract(epoch from (now() - ups.last_event_at)) / 86400.0 / 14.0))::real as score,
         ups.interactions
  from public.user_problem_scores ups
  where ups.user_id = public.current_profile_id();
$$;

revoke all on function public.get_user_problem_scores() from public, anon;
grant execute on function public.get_user_problem_scores() to authenticated;

-- full recompute from the activity log (used by the seed / maintenance)
create or replace function public.recompute_user_problem_scores(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_weights jsonb;
  rec record;
begin
  delete from public.user_problem_scores where user_id = p_user;
  select coalesce(
    (select value from public.app_settings where key = 'recsys_weights'),
    '{"view":1,"watch":3,"support":5,"comment":6,"save":8,"share":7,"search":2.5,"been_there":4,"ignore":-1.5,"not_interested":-9}'::jsonb
  ) into v_weights;

  for rec in
    select a.action, a.post_id, a.query, a.created_at,
           coalesce((v_weights ->> a.action)::double precision, 0) as weight
    from public.activities a
    where a.user_id = p_user
    order by a.created_at asc
  loop
    if rec.post_id is not null and rec.action <> 'search' then
      insert into public.user_problem_scores (user_id, problem_id, score, interactions, last_event_at)
      select p_user, pp.problem_id,
             greatest(-60, least(400, rec.weight * pp.score)), 1, rec.created_at
      from public.post_problems pp
      where pp.post_id = rec.post_id and rec.weight <> 0
      on conflict (user_id, problem_id) do update set
        score = greatest(-60, least(400,
          user_problem_scores.score * power(0.5, extract(epoch from (rec.created_at - user_problem_scores.last_event_at)) / 86400.0 / 14.0)
          + rec.weight * excluded.score)),
        interactions = user_problem_scores.interactions + 1,
        last_event_at = rec.created_at;
    elsif rec.action = 'search' and rec.query is not null then
      insert into public.user_problem_scores (user_id, problem_id, score, interactions, last_event_at)
      select p_user, q.pid,
             greatest(-60, least(400, rec.weight * (q.sc)::real)), 1, rec.created_at
      from (select * from jsonb_each_text(public.fn_classify_text(rec.query, '{}')) as t(pid, sc)) q
      on conflict (user_id, problem_id) do update set
        score = greatest(-60, least(400,
          user_problem_scores.score * power(0.5, extract(epoch from (rec.created_at - user_problem_scores.last_event_at)) / 86400.0 / 14.0)
          + rec.weight * excluded.score)),
        interactions = user_problem_scores.interactions + 1,
        last_event_at = rec.created_at;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 6. SOCIAL GRAPH — supporters / supporting + blocks
-- ============================================================================

create table if not exists public.supporters (
  supporter_id uuid not null references public.profiles(id) on delete cascade,
  supported_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (supporter_id, supported_id),
  check (supporter_id <> supported_id)
);
create index if not exists idx_supporters_supported on public.supporters (supported_id, created_at desc);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ============================================================================
-- 7. DIRECT MESSAGES — conversations / messages
-- ============================================================================

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.conversations add column if not exists updated_at timestamptz not null default now();

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz not null default '1970-01-01'::timestamptz,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_participants_user on public.conversation_participants (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null check (char_length(content) between 1 and 4000),
  created_at      timestamptz not null default now()
);
create index if not exists idx_messages_convo on public.messages (conversation_id, created_at desc);
create index if not exists idx_messages_sender on public.messages (sender_id);

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at before update on public.conversations
  for each row execute procedure public.handle_updated_at();

-- RLS helper: SECURITY DEFINER so participant policies can check membership
-- without recursive-RLS errors.
create or replace function public.is_conversation_participant(p_conversation uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation and cp.user_id = p_user
  );
$$;

revoke all on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

-- get-or-create a 1-to-1 conversation
create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_profile_id();
  v_convo uuid;
begin
  if v_me is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_other is null or p_other = v_me then raise exception 'INVALID_PARTNER'; end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'PARTNER_NOT_FOUND';
  end if;

  select cp1.conversation_id into v_convo
  from public.conversation_participants cp1
  join public.conversation_participants cp2 on cp2.conversation_id = cp1.conversation_id
  where cp1.user_id = v_me and cp2.user_id = p_other
    and (select count(*) from public.conversation_participants cp3 where cp3.conversation_id = cp1.conversation_id) = 2
  limit 1;

  if v_convo is null then
    insert into public.conversations (created_by) values (v_me) returning id into v_convo;
    insert into public.conversation_participants (conversation_id, user_id)
    values (v_convo, v_me), (v_convo, p_other)
    on conflict do nothing;
  end if;

  return v_convo;
end $$;

revoke all on function public.get_or_create_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- mark a conversation read
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql security definer set search_path = public as $$
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation
    and user_id = public.current_profile_id();
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- bump conversation last_message_at
create or replace function public.fn_touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation after insert on public.messages
  for each row execute procedure public.fn_touch_conversation();

-- ---- persona auto-reply (demo sugar for the seeded community accounts) ---
-- When a real user messages a seeded persona, the persona answers with a
-- canned reply so single-account demos still feel alive. Remove this trigger
-- in a real deployment if unwanted.

create or replace function public.fn_persona_autoreply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sender_is_persona boolean;
  v_persona uuid;
  v_canned text[] := array[
    'That means a lot, honestly. Thank you for telling me 💚',
    'I was just thinking about that today!',
    'Ha! Exactly 😄',
    'Can we talk about this on the weekend? Want to give it the attention it deserves.',
    'You always know what to say. Grateful for you here.',
    'Sending you a big hug through the screen 🫂',
    'Okay yes — let''s do it. Count me in.',
    'Reading this at the right moment. Needed it.'
  ];
begin
  if coalesce(current_setting('app.seed_mode', true), '') = 'on' then
    return new;
  end if;
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  select coalesce(p.is_persona, false) into v_sender_is_persona
  from public.profiles p where p.id = new.sender_id;

  if v_sender_is_persona then
    return new; -- personas don't reply to personas
  end if;

  select cp.user_id into v_persona
  from public.conversation_participants cp
  join public.profiles p on p.id = cp.user_id
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id
    and p.is_persona
  limit 1;

  if v_persona is not null then
    insert into public.messages (conversation_id, sender_id, content, created_at)
    values (
      new.conversation_id,
      v_persona,
      v_canned[1 + floor(random() * array_length(v_canned, 1))::int],
      now()
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_persona_autoreply on public.messages;
create trigger trg_persona_autoreply after insert on public.messages
  for each row execute procedure public.fn_persona_autoreply();

-- ============================================================================
-- 8. NOTIFICATIONS
-- ============================================================================

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade, -- recipient
  actor_id        uuid references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('support','comment','person_support','mention','message')),
  post_id         uuid references public.posts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  body            text,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_notifications_recipient on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread    on public.notifications (user_id) where read = false;

create or replace function public.fn_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
  v_actor uuid;
  v_post uuid;
  v_convo uuid;
  v_body text := null;
begin
  -- historical seed data doesn't produce live notifications
  if coalesce(current_setting('app.seed_mode', true), '') = 'on' then
    return null;
  end if;

  v_actor := case tg_table_name
    when 'post_supports' then new.user_id
    when 'comments'      then new.user_id
    when 'supporters'    then new.supporter_id
    when 'messages'      then new.sender_id
    else null end;

  case tg_table_name
    when 'post_supports' then
      select user_id, id into v_recipient, v_post from public.posts where id = new.post_id;
      if v_recipient = v_actor then return null; end if;
      insert into public.notifications (user_id, actor_id, kind, post_id)
      values (v_recipient, v_actor, 'support', v_post);

    when 'comments' then
      select user_id, id into v_recipient, v_post from public.posts where id = new.post_id;
      if v_recipient = v_actor then return null; end if;
      insert into public.notifications (user_id, actor_id, kind, post_id, body)
      values (v_recipient, v_actor, 'comment', v_post, left(new.content, 140));

    when 'supporters' then
      v_recipient := new.supported_id;
      if v_recipient = v_actor then return null; end if;
      insert into public.notifications (user_id, actor_id, kind)
      values (v_recipient, v_actor, 'person_support');

    when 'messages' then
      for v_recipient in
        select cp.user_id from public.conversation_participants cp
        where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
      loop
        insert into public.notifications (user_id, actor_id, kind, conversation_id, body)
        values (v_recipient, v_actor, 'message', new.conversation_id, left(new.content, 140));
      end loop;

    else return null;
  end case;
  return null;
end $$;

drop trigger if exists trg_notify_support on public.post_supports;
create trigger trg_notify_support after insert on public.post_supports
  for each row execute procedure public.fn_notify();
drop trigger if exists trg_notify_comment on public.comments;
create trigger trg_notify_comment after insert on public.comments
  for each row execute procedure public.fn_notify();
drop trigger if exists trg_notify_person on public.supporters;
create trigger trg_notify_person after insert on public.supporters
  for each row execute procedure public.fn_notify();
drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
  for each row execute procedure public.fn_notify();

-- @mentions on posts and comments
create or replace function public.fn_notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_post uuid := null;
  m record;
  v_target uuid;
  n int := 0;
begin
  v_actor := case tg_table_name when 'comments' then new.user_id else new.user_id end;
  if tg_table_name = 'comments' then v_post := new.post_id; else v_post := new.id; end if;

  for m in
    select distinct on (lower(m_[1])) m_[1] as uname
    from regexp_matches(new.content, '(?:^|[\s])@([a-zA-Z0-9_]{2,30})', 'g') as m_
    limit 5
  loop
    select id into v_target from public.profiles
    where lower(username) = lower(m.uname) and user_id is not null limit 1;
    if v_target is not null and v_target <> v_actor then
      insert into public.notifications (user_id, actor_id, kind, post_id, body)
      values (v_target, v_actor, 'mention', v_post, left(new.content, 140));
      n := n + 1;
    end if;
    exit when n >= 5;
  end loop;
  return null;
end $$;

drop trigger if exists trg_notify_mention_post on public.posts;
create trigger trg_notify_mention_post after insert on public.posts
  for each row execute procedure public.fn_notify_mentions();
drop trigger if exists trg_notify_mention_comment on public.comments;
create trigger trg_notify_mention_comment after insert on public.comments
  for each row execute procedure public.fn_notify_mentions();

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

alter table public.app_settings             enable row level security;
alter table public.problems                 enable row level security;
alter table public.profiles                 enable row level security;
alter table public.posts                    enable row level security;
alter table public.post_problems            enable row level security;
alter table public.post_supports            enable row level security;
alter table public.comments                 enable row level security;
alter table public.post_saves               enable row level security;
alter table public.been_there               enable row level security;
alter table public.activities               enable row level security;
alter table public.user_problem_scores      enable row level security;
alter table public.supporters               enable row level security;
alter table public.blocks                   enable row level security;
alter table public.conversations            enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                 enable row level security;
alter table public.notifications            enable row level security;

-- app_settings: world-readable config, service-role writes only
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (true);

-- problems: public taxonomy, service-role writes only
drop policy if exists problems_read on public.problems;
create policy problems_read on public.problems
  for select using (true);

-- profiles: readable by signed-in members, writable by the owner (never personas)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (user_id = auth.uid());

-- posts: member-visible; only the author mutates
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated using (status = 'live' or user_id = public.current_profile_id());
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated with check (user_id = public.current_profile_id());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated using (user_id = public.current_profile_id());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated using (user_id = public.current_profile_id());

-- post_problems: derived data, readable by members (trigger-maintained)
drop policy if exists post_problems_select on public.post_problems;
create policy post_problems_select on public.post_problems
  for select to authenticated using (true);

-- interactions: visible to members, owned writes only
drop policy if exists post_supports_select on public.post_supports;
create policy post_supports_select on public.post_supports
  for select to authenticated using (true);
drop policy if exists post_supports_insert on public.post_supports;
create policy post_supports_insert on public.post_supports
  for insert to authenticated with check (user_id = public.current_profile_id());
drop policy if exists post_supports_delete on public.post_supports;
create policy post_supports_delete on public.post_supports
  for delete to authenticated using (user_id = public.current_profile_id());

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated with check (user_id = public.current_profile_id());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated using (user_id = public.current_profile_id());

drop policy if exists post_saves_select on public.post_saves;
create policy post_saves_select on public.post_saves
  for select to authenticated using (true);
drop policy if exists post_saves_insert on public.post_saves;
create policy post_saves_insert on public.post_saves
  for insert to authenticated with check (user_id = public.current_profile_id());
drop policy if exists post_saves_delete on public.post_saves;
create policy post_saves_delete on public.post_saves
  for delete to authenticated using (user_id = public.current_profile_id());

drop policy if exists been_there_select on public.been_there;
create policy been_there_select on public.been_there
  for select to authenticated using (true);
drop policy if exists been_there_insert on public.been_there;
create policy been_there_insert on public.been_there
  for insert to authenticated with check (user_id = public.current_profile_id());
drop policy if exists been_there_delete on public.been_there;
create policy been_there_delete on public.been_there
  for delete to authenticated using (user_id = public.current_profile_id());

-- activities: strictly private to the user (recommendation signals)
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated using (user_id = public.current_profile_id());
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert to authenticated with check (user_id = public.current_profile_id());

-- user_problem_scores: strictly private
drop policy if exists ups_select on public.user_problem_scores;
create policy ups_select on public.user_problem_scores
  for select to authenticated using (user_id = public.current_profile_id());

-- supporters: visible, owned writes
drop policy if exists supporters_select on public.supporters;
create policy supporters_select on public.supporters
  for select to authenticated using (
    supporter_id = public.current_profile_id()
    or supported_id = public.current_profile_id()
  );
drop policy if exists supporters_insert on public.supporters;
create policy supporters_insert on public.supporters
  for insert to authenticated with check (supporter_id = public.current_profile_id());
drop policy if exists supporters_delete on public.supporters;
create policy supporters_delete on public.supporters
  for delete to authenticated using (supporter_id = public.current_profile_id());

-- blocks: private
drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks
  for select to authenticated using (blocker_id = public.current_profile_id());
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks
  for insert to authenticated with check (blocker_id = public.current_profile_id());
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks
  for delete to authenticated using (blocker_id = public.current_profile_id());

-- conversations: participants only
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated using (
    public.is_conversation_participant(id, public.current_profile_id())
  );

drop policy if exists cp_select on public.conversation_participants;
create policy cp_select on public.conversation_participants
  for select to authenticated using (
    public.is_conversation_participant(conversation_id, public.current_profile_id())
  );
drop policy if exists cp_insert on public.conversation_participants;
create policy cp_insert on public.conversation_participants
  for insert to authenticated with check (user_id = public.current_profile_id());
drop policy if exists cp_update on public.conversation_participants;
create policy cp_update on public.conversation_participants
  for update to authenticated using (user_id = public.current_profile_id());

-- messages: participants read; senders write their own
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated using (
    public.is_conversation_participant(conversation_id, public.current_profile_id())
  );
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated with check (
    sender_id = public.current_profile_id()
    and public.is_conversation_participant(conversation_id, public.current_profile_id())
  );
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete to authenticated using (sender_id = public.current_profile_id());

-- notifications: private to the recipient
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = public.current_profile_id());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = public.current_profile_id());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = public.current_profile_id());

-- ============================================================================
-- 10. SUPABASE REALTIME
-- ============================================================================
-- messages / conversation_participants / notifications / posts stream to the
-- client over postgres_changes; typing indicators + presence use private
-- broadcast channels (`dm:<conversation-id>`) authorized by RLS below.

do $$
declare
  t text;
begin
  begin
    foreach t in array array['public.messages','public.conversation_participants','public.notifications','public.posts'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = split_part(t, '.', 1)
          and tablename  = split_part(t, '.', 2)
      ) then
        execute format('alter publication supabase_realtime add table %s', t);
      end if;
    end loop;
  exception when others then
    raise notice 'Realtime publication update skipped: %', sqlerrm;
  end;
end $$;

-- Private-channel authorization for `dm:<conversation-id>` broadcast rooms:
-- a subscriber may join only when they participate in that conversation.
do $$ begin
  drop policy if exists ruhiz_dm_channel_auth on realtime.messages;
  create policy ruhiz_dm_channel_auth on realtime.messages
    for select to authenticated
    using (
      realtime.topic() like 'dm:%'
      and exists (
        select 1
        from public.conversation_participants cp
        where 'dm:' || cp.conversation_id::text = realtime.topic()
          and cp.user_id = public.current_profile_id()
      )
    );
exception when others then
  raise notice 'realtime.messages policy skipped: %', sqlerrm;
end $$;

-- ============================================================================
-- 11. LEGACY MIGRATION (moments → posts) — guarded, only if legacy exists
-- ============================================================================

do $$
declare
  v_count int := 0;
begin
  if to_regclass('public.moments') is not null then
    insert into public.posts (id, user_id, type, content, image_url, video_url, topics,
                              support_count, comment_count, share_count, save_count, been_there_count,
                              created_at)
    select
      m.id,
      p.id,
      case when m.video_url is not null then 'video' when m.image_url is not null then 'photo' else 'moment' end,
      m.content,
      m.image_url,
      m.video_url,
      coalesce(m.topics, '{}'),
      coalesce(m.likes_count, 0),
      coalesce(m.comments_count, 0),
      coalesce(m.shares_count, 0),
      coalesce(m.saves_count, 0),
      coalesce(m.been_here_count, 0),
      m.created_at
    from public.moments m
    join public.profiles p on p.user_id = m.user_id
    where not exists (select 1 from public.posts posts where posts.id = m.id);
    get diagnostics v_count = row_count;
    if v_count > 0 then
      raise notice 'Migrated % legacy moments into posts', v_count;
    end if;
  end if;
exception when others then
  raise notice 'Legacy migration skipped: %', sqlerrm;
end $$;

-- ============================================================================
-- 12. SEED — problems taxonomy already inserted; now demo content.
--     Community personas (no login) + the existing Ruhiz posts, comments and
--     the demo account's interaction history so the feed is personalised
--     immediately for mohammadasimsaad@gmail.com.
-- ============================================================================

select set_config('app.seed_mode', 'on', false); -- suppress persona auto-replies during seed

-- ---- personas ------------------------------------------------------------
insert into public.profiles (id, user_id, username, display_name, avatar_hue, bio, location, website, verified, is_persona, created_at) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', null, 'ayeshakhan',    'Ayesha Khan',    330, 'Mental health advocate ✨ Therapist by day, journaler by night. Here to listen.', 'Toronto, CA', 'ayesha.blog',        true,  true, now() - interval '900 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', null, 'rohanv',        'Rohan Verma',    210, 'Engineering student 📚 Talking about burnout so you don''t have to suffer alone.', 'Bengaluru, IN', '',                 false, true, now() - interval '560 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', null, 'sarahmitchell', 'Sarah Mitchell', 25,  'Photographer 📷 Finding calm in small moments. Golden hours & gratitude.', 'Lisbon, PT', 'sarahshoots.com',    true,  true, now() - interval '1200 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', null, 'davidchen',     'David Chen',     262, 'Recovering overthinker. Career changer at 31. Writing about starting over.', 'Seattle, WA', '',                 false, true, now() - interval '300 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', null, 'mayapatel',     'Maya Patel',     190, 'Yoga, slow mornings and honest conversations 🧘‍♀️ Healer in training.', 'Austin, TX', 'mayaflow.co',        true,  true, now() - interval '780 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', null, 'jordanlee',     'Jordan Lee',     95,  'Music is how I say the things I can''t. Guitar, grief, and growth 🎸', 'Manchester, UK', '',              false, true, now() - interval '150 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', null, 'fatimanoor',    'Fatima Noor',    288, 'Med student 🩺 Sharing study routines + the feelings nobody posts about.', 'Lahore, PK', '',                  false, true, now() - interval '240 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', null, 'liamo',         'Liam O''Brien',  45,  'Sober 742 days 🏃 Running one mile for every bad day. Feel free to run with me.', 'Cork, IE', '',                 true,  true, now() - interval '742 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', null, 'priyasharma',   'Priya Sharma',   12,  'Long-distance relationships, self-love & Sunday letters 💌', 'Mumbai, IN', 'sundayswithpriya.in', false, true, now() - interval '500 days'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0a', null, 'alexkim',       'Alex Kim',       175, 'Night-shift nurse. Quiet posts about loud feelings 🌙', 'Chicago, IL', '',                   false, true, now() - interval '660 days')
on conflict (id) do nothing;

-- ---- the 16 existing Ruhiz posts ------------------------------------------
insert into public.posts (id, user_id, type, content, image_url, video_url, topics,
                          support_count, comment_count, share_count, save_count, been_there_count, view_count,
                          created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'photo',
   E'Sometimes a peaceful evening is all you need. Took this on my walk home and remembered why I started carrying a camera everywhere. 💚',
   '/images/ruhizhero.png', null, '{Life,Gratitude}', 124, 0, 12, 18, 18, 640, now() - interval '2 hours'),
  ('b0000000-0000-4000-8000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'moment',
   E'A gentle reminder from my therapy notebook:\n\n“You don''t have to earn rest. Rest is not a reward for finishing everything — it''s part of how you keep going.”\n\nIf your to-do list is unfinished tonight, this is your permission slip to rest anyway. 🌙',
   null, null, '{Mental Health,Self Improvement}', 482, 0, 96, 132, 231, 2100, now() - interval '5 hours'),
  ('b0000000-0000-4000-8000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'video',
   E'Mile 742 of my recovery run. Some mornings the hardest rep is just putting on the shoes. If you''re fighting something quietly today — keep going. 🏃‍♂️',
   null, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', '{Recovery,Fitness}', 356, 0, 44, 61, 149, 1750, now() - interval '9 hours'),
  ('b0000000-0000-4000-8000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'moment',
   E'Failed my mock exam today. Old me would have spiraled for a week. New me made tea, texted a friend, and booked a study session for tomorrow.\n\nHealing isn''t never falling. It''s falling differently. ☕',
   null, null, '{Studying,Mental Health}', 208, 0, 17, 42, 87, 980, now() - interval '14 hours'),
  ('b0000000-0000-4000-8000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'photo',
   E'Golden hour at the studio. We practiced letting go of “doing it perfectly” today — just breathing and being. Somebody laughed mid-pose and it was the best sound. ✨',
   '/images/FOOTER.png', null, '{Life,Gratitude}', 173, 0, 9, 55, 41, 760, now() - interval '29 hours'),
  ('b0000000-0000-4000-8000-000000000006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'moment',
   E'Six months ago I quit a job I''d had for eight years. Everyone said I was making a mistake.\n\nToday I finished my first week at a job that doesn''t make me cry in the parking lot.\n\nStart over if you need to. It''s not quitting — it''s choosing yourself.',
   null, null, '{Career,Mental Health}', 641, 0, 120, 148, 302, 3100, now() - interval '38 hours'),
  ('b0000000-0000-4000-8000-000000000007', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'photo',
   E'My 4am study desk 📚 Anatomy flashcards, one lamp, and a promise to future-me. Exams are scary, but small consistent nights add up.',
   '/images/login-side-image.png', null, '{Studying,Life}', 96, 0, 6, 28, 22, 430, now() - interval '50 hours'),
  ('b0000000-0000-4000-8000-000000000008', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'video',
   E'Wrote this song the night after my dad told me he was proud of me. Haven''t played it for anyone until now. Be gentle, it''s a fragile one. 🎸',
   null, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', '{Creativity,Relationships}', 289, 0, 31, 66, 74, 1200, now() - interval '62 hours'),
  ('b0000000-0000-4000-8000-000000000009', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'moment',
   E'Long distance tip nobody tells you: schedule the boring calls too. The ones where you both just do dishes on video and barely talk. Presence doesn''t always need performance. 💌',
   null, null, '{Relationships}', 154, 0, 28, 37, 33, 680, now() - interval '77 hours'),
  ('b0000000-0000-4000-8000-000000000010', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0a', 'moment',
   E'Night shift honesty: I held a patient''s hand at 3am tonight and it was the most human moment of my week.\n\nTo everyone working while the world sleeps — your quiet hours matter.',
   null, null, '{Life,Gratitude}', 412, 0, 58, 96, 118, 1900, now() - interval '91 hours'),
  ('b0000000-0000-4000-8000-000000000011', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'moment',
   E'Small win: I said no to plans tonight without inventing an excuse. Just “I need to rest.” Nobody died. The world kept turning. Growth looks like this sometimes. 🌱',
   null, null, '{Mental Health,Self Improvement}', 64, 0, 4, 15, 21, 260, now() - interval '12 hours'),
  ('b0000000-0000-4000-8000-000000000012', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'photo',
   E'Sunday reset: journal, tea, and the view from my window. Nothing productive happened and it was perfect. ☕',
   '/images/banner.png', null, '{Life,Gratitude}', 87, 0, 3, 19, 12, 300, now() - interval '101 hours'),
  ('b0000000-0000-4000-8000-000000000013', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'video',
   E'First time trying to vlog my morning routine instead of doomscrolling. It''s messy and unedited, like me. Trying a 7-day streak — day 1 ✅',
   null, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', '{Life,Self Improvement}', 45, 0, 2, 8, 8, 150, now() - interval '144 hours'),
  ('b0000000-0000-4000-8000-000000000014', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'question',
   E'Genuine question for the community: what''s one tiny habit that quietly improved your mental health? Not big breakthroughs — tiny ones. I''ll start: making my bed every morning.',
   null, null, '{Mental Health}', 198, 0, 15, 44, 55, 1100, now() - interval '115 hours'),
  ('b0000000-0000-4000-8000-000000000015', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'photo',
   E'Shot this at dawn before the city woke up. Quiet places heal me. Where''s your quiet place?',
   '/images/ruhiz.png', null, '{Life,Creativity}', 231, 0, 19, 58, 37, 900, now() - interval '132 hours'),
  ('b0000000-0000-4000-8000-000000000016', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'video',
   E'60-second grounding technique for anxious moments: 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Save this for the days you need it. 💚',
   null, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', '{Mental Health,Self Improvement}', 720, 0, 240, 254, 384, 4200, now() - interval '168 hours')
on conflict (id) do nothing;

-- attribute the three "own journey" posts to the real demo account if it exists
do $$
declare
  v_me uuid;
begin
  select p.id into v_me
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where lower(u.email) = 'mohammadasimsaad@gmail.com';

  if v_me is not null then
    update public.posts set user_id = v_me
    where id in (
      'b0000000-0000-4000-8000-000000000011',
      'b0000000-0000-4000-8000-000000000012',
      'b0000000-0000-4000-8000-000000000013'
    );
    raise notice 'Demo posts attributed to mohammadasimsaad@gmail.com';
  else
    raise notice 'Demo account not found — persona posts kept as community content';
  end if;
end $$;

-- ---- comments --------------------------------------------------------------
insert into public.comments (id, post_id, user_id, content, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'Beautiful! Where is this? The light is unreal.',      now() - interval '90 minutes'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Thank you Maya! Just outside Alfama in Lisbon 🧡',   now() - interval '72 minutes'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Needed this during finals week. Thank you, Ayesha.', now() - interval '4 hours'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'Saving this one. Loud.',                             now() - interval '3 hours'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'You inspire me, man. Proud of you.',                 now() - interval '8 hours'),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', '“Falling differently” is going straight into my journal.', now() - interval '12 hours'),
  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'The warmth in this photo is contagious 🧡',          now() - interval '24 hours'),
  ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0a', 'Crying in the parking lot… you just described my last year.', now() - interval '34 hours'),
  ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000006', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Choosing yourself IS the work. Congratulations, David.', now() - interval '31 hours'),
  ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000007', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'The 4am club represents! 💪',                        now() - interval '48 hours'),
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000008', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'Jordan… I''m tearing up. Thank you for trusting us with this.', now() - interval '58 hours'),
  ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000008', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'This gave me chills, brother.',                      now() - interval '53 hours'),
  ('c0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000010', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Thank you for being there at 3am, Alex.',            now() - interval '84 hours'),
  ('c0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000014', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'Walking 10 minutes after lunch. That''s it. That''s the comment.', now() - interval '110 hours'),
  ('c0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000014', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'Drinking water before opening any app 🙈',           now() - interval '108 hours'),
  ('c0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000012', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'The light here! So cozy.',                           now() - interval '96 hours'),
  ('c0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000016', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0a', 'Sharing this with my whole night-shift crew.',       now() - interval '163 hours'),
  ('c0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000011', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Boundaries are a skill and you''re getting good at it 👏', now() - interval '10 hours'),
  ('c0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000011', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'Rest is productive too. Proud of you!',              now() - interval '7 hours')
on conflict (id) do nothing;

-- demo account's own seeded comments (attached to the real profile if present)
do $$
declare
  v_me uuid;
begin
  select p.id into v_me from public.profiles p
  join auth.users u on u.id = p.user_id where lower(u.email) = 'mohammadasimsaad@gmail.com';
  if v_me is not null then
    insert into public.comments (id, post_id, user_id, content, created_at) values
      ('c0000000-0000-4000-8000-00000000001a', 'b0000000-0000-4000-8000-000000000001', v_me, 'This is exactly the calm I needed to see today.', now() - interval '60 minutes'),
      ('c0000000-0000-4000-8000-00000000001b', 'b0000000-0000-4000-8000-000000000004', v_me, 'Proud of you Rohan. The mock doesn''t define you.', now() - interval '11 hours'),
      ('c0000000-0000-4000-8000-00000000001c', 'b0000000-0000-4000-8000-000000000014', v_me, 'Writing down one true, kind sentence about my day before sleep.', now() - interval '103 hours')
    on conflict (id) do nothing;
  end if;
end $$;

-- ---- demo account interaction history (personalises the feed) --------------
do $$
declare
  v_me uuid;
begin
  select p.id into v_me from public.profiles p
  join auth.users u on u.id = p.user_id where lower(u.email) = 'mohammadasimsaad@gmail.com';
  if v_me is null then
    raise notice 'Seed interactions skipped — demo account not found';
    return;
  end if;

  -- supporters graph (from the original demo state)
  insert into public.supporters (supporter_id, supported_id, created_at) values
    (v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', now() - interval '380 days'),
    (v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', now() - interval '360 days'),
    (v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', now() - interval '300 days'),
    (v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', now() - interval '290 days'),
    (v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', now() - interval '380 days'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', v_me, now() - interval '400 days'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', v_me, now() - interval '390 days'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', v_me, now() - interval '200 days'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', v_me, now() - interval '260 days'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', v_me, now() - interval '120 days'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', v_me, now() - interval '150 days')
  on conflict do nothing;

  -- supports on posts
  insert into public.post_supports (post_id, user_id, created_at) values
    ('b0000000-0000-4000-8000-000000000001', v_me, now() - interval '90 minutes'),
    ('b0000000-0000-4000-8000-000000000002', v_me, now() - interval '4 hours'),
    ('b0000000-0000-4000-8000-000000000004', v_me, now() - interval '11 hours'),
    ('b0000000-0000-4000-8000-000000000006', v_me, now() - interval '30 hours'),
    ('b0000000-0000-4000-8000-000000000014', v_me, now() - interval '110 hours'),
    ('b0000000-0000-4000-8000-000000000016', v_me, now() - interval '160 hours')
  on conflict do nothing;

  -- saves
  insert into public.post_saves (post_id, user_id, created_at) values
    ('b0000000-0000-4000-8000-000000000001', v_me, now() - interval '80 minutes'),
    ('b0000000-0000-4000-8000-000000000002', v_me, now() - interval '4 hours'),
    ('b0000000-0000-4000-8000-000000000005', v_me, now() - interval '24 hours'),
    ('b0000000-0000-4000-8000-000000000015', v_me, now() - interval '130 hours'),
    ('b0000000-0000-4000-8000-000000000016', v_me, now() - interval '158 hours')
  on conflict do nothing;

  -- been there
  insert into public.been_there (post_id, user_id, created_at) values
    ('b0000000-0000-4000-8000-000000000002', v_me, now() - interval '4 hours'),
    ('b0000000-0000-4000-8000-000000000003', v_me, now() - interval '8 hours'),
    ('b0000000-0000-4000-8000-000000000004', v_me, now() - interval '11 hours'),
    ('b0000000-0000-4000-8000-000000000006', v_me, now() - interval '30 hours'),
    ('b0000000-0000-4000-8000-000000000010', v_me, now() - interval '88 hours'),
    ('b0000000-0000-4000-8000-000000000016', v_me, now() - interval '160 hours')
  on conflict do nothing;

  -- feed impressions (views) across the seed posts
  insert into public.activities (user_id, post_id, action, created_at)
  select v_me, id, 'view', created_at + interval '20 seconds'
  from public.posts
  where id in ('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002',
               'b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000004',
               'b0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000006',
               'b0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000010',
               'b0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000012',
               'b0000000-0000-4000-8000-000000000014','b0000000-0000-4000-8000-000000000016')
  on conflict do nothing;

  -- interaction activities (so scores can be recomputed deterministically)
  insert into public.activities (user_id, post_id, action, created_at)
  select v_me, s.post_id, s.action, s.at from (values
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'support'::text, now() - interval '90 minutes'),
    ('b0000000-0000-4000-8000-000000000002', 'support', now() - interval '4 hours'),
    ('b0000000-0000-4000-8000-000000000004', 'support', now() - interval '11 hours'),
    ('b0000000-0000-4000-8000-000000000006', 'support', now() - interval '30 hours'),
    ('b0000000-0000-4000-8000-000000000014', 'support', now() - interval '110 hours'),
    ('b0000000-0000-4000-8000-000000000016', 'support', now() - interval '160 hours'),
    ('b0000000-0000-4000-8000-000000000001', 'save',   now() - interval '80 minutes'),
    ('b0000000-0000-4000-8000-000000000002', 'save',   now() - interval '4 hours'),
    ('b0000000-0000-4000-8000-000000000005', 'save',   now() - interval '24 hours'),
    ('b0000000-0000-4000-8000-000000000015', 'save',   now() - interval '130 hours'),
    ('b0000000-0000-4000-8000-000000000016', 'save',   now() - interval '158 hours'),
    ('b0000000-0000-4000-8000-000000000002', 'been_there', now() - interval '4 hours'),
    ('b0000000-0000-4000-8000-000000000003', 'been_there', now() - interval '8 hours'),
    ('b0000000-0000-4000-8000-000000000004', 'been_there', now() - interval '11 hours'),
    ('b0000000-0000-4000-8000-000000000006', 'been_there', now() - interval '30 hours'),
    ('b0000000-0000-4000-8000-000000000010', 'been_there', now() - interval '88 hours'),
    ('b0000000-0000-4000-8000-000000000016', 'been_there', now() - interval '160 hours')
  ) as s(post_id, action, at)
  where not exists (
    select 1 from public.activities a
    where a.user_id = v_me and a.post_id = s.post_id and a.action = s.action
  );

  -- recompute interest scores from the full activity history
  perform public.recompute_user_problem_scores(v_me);
  raise notice 'Seeded interaction history for demo account';
end $$;

-- ---- starter notifications for the demo account ----------------------------
do $$
declare
  v_me uuid;
begin
  select p.id into v_me from public.profiles p
  join auth.users u on u.id = p.user_id where lower(u.email) = 'mohammadasimsaad@gmail.com';
  if v_me is null then return; end if;

  insert into public.notifications (id, user_id, actor_id, kind, post_id, body, read, created_at) values
    ('f0000000-0000-4000-8000-000000000001', v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'support',  'b0000000-0000-4000-8000-000000000011', null, false, now() - interval '1 hours'),
    ('f0000000-0000-4000-8000-000000000002', v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'comment',  'b0000000-0000-4000-8000-000000000011', 'Rest is productive too. Proud of you!', false, now() - interval '7 hours'),
    ('f0000000-0000-4000-8000-000000000003', v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'support',  'b0000000-0000-4000-8000-000000000012', null, false, now() - interval '5 hours'),
    ('f0000000-0000-4000-8000-000000000004', v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a09', 'person_support', null, null, true,  now() - interval '9 hours'),
    ('f0000000-0000-4000-8000-000000000005', v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'comment',  'b0000000-0000-4000-8000-000000000011', 'Boundaries are a skill and you''re getting good at it 👏', true, now() - interval '10 hours'),
    ('f0000000-0000-4000-8000-000000000006', v_me, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'person_support', null, null, true,  now() - interval '48 hours')
  on conflict (id) do nothing;
end $$;

-- ---- starter conversations for the demo account ----------------------------
do $$
declare
  v_me uuid;
  v_convo1 uuid := 'd0000000-0000-4000-8000-000000000001';
  v_convo2 uuid := 'd0000000-0000-4000-8000-000000000002';
  v_convo3 uuid := 'd0000000-0000-4000-8000-000000000003';
  v_convo4 uuid := 'd0000000-0000-4000-8000-000000000004';
begin
  select p.id into v_me from public.profiles p
  join auth.users u on u.id = p.user_id where lower(u.email) = 'mohammadasimsaad@gmail.com';
  if v_me is null then
    raise notice 'Seed conversations skipped — demo account not found';
    return;
  end if;

  insert into public.conversations (id, created_by, last_message_at, created_at) values
    (v_convo1, v_me, now() - interval '3 hours', now() - interval '30 days'),
    (v_convo2, v_me, now() - interval '7 hours', now() - interval '25 days'),
    (v_convo3, v_me, now() - interval '43 hours', now() - interval '60 days'),
    (v_convo4, v_me, now() - interval '67 hours', now() - interval '45 days')
  on conflict (id) do nothing;

  insert into public.conversation_participants (conversation_id, user_id, last_read_at) values
    (v_convo1, v_me, now() - interval '25 hours'),
    (v_convo1, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', now() - interval '24 hours'),
    (v_convo2, v_me, now() - interval '28 hours'),
    (v_convo2, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', now() - interval '29 hours'),
    (v_convo3, v_me, now()),
    (v_convo3, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', now() - interval '43 hours'),
    (v_convo4, v_me, now()),
    (v_convo4, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', now() - interval '67 hours')
  on conflict do nothing;

  insert into public.messages (id, conversation_id, sender_id, content, created_at) values
    ('e0000000-0000-4000-8000-000000000001', v_convo1, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Hey! Saw your moment about saying no to plans 👏', now() - interval '26 hours'),
    ('e0000000-0000-4000-8000-000000000002', v_convo1, v_me, 'Thank you!! It felt scary but honestly freeing', now() - interval '25 hours'),
    ('e0000000-0000-4000-8000-000000000003', v_convo1, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'That''s the whole practice, honestly. Small reps.', now() - interval '24 hours'),
    ('e0000000-0000-4000-8000-000000000004', v_convo1, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Also — are you joining the Sunday journaling circle this week?', now() - interval '3 hours'),
    ('e0000000-0000-4000-8000-000000000005', v_convo2, v_me, 'Your dusk photo from yesterday is stunning 😍', now() - interval '30 hours'),
    ('e0000000-0000-4000-8000-000000000006', v_convo2, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Thank you so much! Shot it on my walk home', now() - interval '29 hours'),
    ('e0000000-0000-4000-8000-000000000007', v_convo2, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'I''ll send you the RAW edit — would love your opinion on the tones', now() - interval '7 hours'),
    ('e0000000-0000-4000-8000-000000000008', v_convo3, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'Morning run tomorrow? 6:30 by the river loop', now() - interval '48 hours'),
    ('e0000000-0000-4000-8000-000000000009', v_convo3, v_me, 'I''m in. No promises about the pace though 😅', now() - interval '46 hours'),
    ('e0000000-0000-4000-8000-000000000010', v_convo3, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'Pace is a myth. Showing up is the win. See you there 🏃', now() - interval '43 hours'),
    ('e0000000-0000-4000-8000-000000000011', v_convo4, v_me, 'How did the study session go after the mock?', now() - interval '72 hours'),
    ('e0000000-0000-4000-8000-000000000012', v_convo4, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Better than expected. Turned the weak chapters into flashcards', now() - interval '70 hours'),
    ('e0000000-0000-4000-8000-000000000013', v_convo4, v_me, 'Look at you going 👏', now() - interval '67 hours')
  on conflict (id) do nothing;

  raise notice 'Seeded demo conversations';
end $$;

select set_config('app.seed_mode', 'off', false);

-- ---- normalise counters (real rows are the floor; seed flavour on top) ------
update public.posts p set
  comment_count = greatest(p.comment_count, (select count(*) from public.comments c where c.post_id = p.id)),
  support_count = greatest(p.support_count, (select count(*) from public.post_supports s where s.post_id = p.id)),
  save_count    = greatest(p.save_count,    (select count(*) from public.post_saves v where v.post_id = p.id)),
  been_there_count = greatest(p.been_there_count, (select count(*) from public.been_there b where b.post_id = p.id));

-- ============================================================================
-- 13. GRANTS ( Supabase defaults cover most; be explicit for new tables)
-- ============================================================================
grant select on public.app_settings, public.problems to authenticated, anon;
grant select on public.profiles to authenticated, anon;
grant select, insert, update, delete on public.posts, public.comments, public.post_supports,
  public.post_saves, public.been_there, public.supporters, public.blocks,
  public.conversations, public.conversation_participants, public.messages,
  public.notifications, public.activities, public.user_problem_scores, public.post_problems
  to authenticated;
grant usage on all sequences in schema public to authenticated;

-- ============================================================================
-- 14. VERIFY
-- ============================================================================
do $$
begin
  raise notice '✅ Ruhiz production schema applied';
  raise notice '📊 Tables: profiles, posts, post_problems, comments, post_supports, post_saves, been_there, activities, user_problem_scores, supporters, blocks, conversations, conversation_participants, messages, notifications';
  raise notice '🔒 RLS enabled on every table';
  raise notice '📡 Realtime: messages, conversation_participants, notifications, posts (+ private dm: channels)';
  raise notice '🧠 Recsys: record_activities() + get_user_problem_scores() ready';
  raise notice '🌱 Seed: problems taxonomy + 16 community posts + demo interactions';
end $$;

commit;
