-- RUHIZ initial schema.
-- Non-destructive: only CREATEs objects in the public schema. Never touches neon_auth.* data;
-- it only references neon_auth."user"(id) so account deletion cascades to app data.

-- ───────────────────────── Reference data ─────────────────────────
create table if not exists categories (
  id          text primary key check (id ~ '^[a-z][a-z0-9-]{1,40}$'),
  label       text not null,
  sort_order  int  not null default 0
);

insert into categories (id, label, sort_order) values
  ('mental-health', 'Mental Health', 1), ('education', 'Education', 2), ('student-life', 'Student Life', 3),
  ('career', 'Career & Jobs', 4), ('relationships', 'Relationships', 5), ('family', 'Family', 6),
  ('technology', 'Technology', 7), ('environment', 'Environment', 8), ('community', 'Community', 9),
  ('finance', 'Finance', 10), ('health', 'Health', 11), ('self-improvement', 'Self Improvement', 12),
  ('infrastructure', 'Infrastructure', 13)
on conflict (id) do nothing;

-- ───────────────────────── Profiles ─────────────────────────
create table if not exists profiles (
  user_id          uuid primary key references neon_auth."user"(id) on delete cascade,
  code             char(6) not null unique check (code ~ '^[A-Z0-9]{6}$'),
  headline         text not null default '' check (char_length(headline) <= 80),
  bio              text not null default '' check (char_length(bio) <= 280),
  location         text not null default '' check (char_length(location) <= 80),
  identity_mode    text not null default 'saver' check (identity_mode in ('saver', 'revealer')),
  revealed_name    text not null default '' check (char_length(revealed_name) <= 60),
  revealed_role    text not null default '' check (char_length(revealed_role) <= 80),
  expertise        text[] not null default '{}' check (cardinality(expertise) <= 12),
  can_help_with    text[] not null default '{}' check (can_help_with <@ array['knowledge','technical','research','funding','equipment','volunteering','local','professional','organization','other']::text[]),
  avatar_media_id  uuid,
  settings         jsonb not null default '{}'::jsonb,
  onboarded        boolean not null default false,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists profiles_location_idx on profiles (lower(btrim(location))) where location <> '';

-- ───────────────────────── Posts ─────────────────────────
create table if not exists posts (
  id                 uuid primary key default gen_random_uuid(),
  author_id          uuid not null references profiles(user_id) on delete cascade,
  kind               text not null check (kind in ('photo', 'video', 'thought')),
  intent             text not null check (intent in ('problem', 'experience', 'thought', 'solution', 'support', 'update')),
  category_id        text not null references categories(id),
  title              text check (title is null or char_length(title) between 1 and 140),
  body               text not null check (char_length(body) between 1 and 5000),
  identity_mode      text not null check (identity_mode in ('saver', 'revealer')),
  location           text not null default '' check (char_length(location) <= 80),
  status             text check (status in ('unsolved', 'discussion', 'solutions', 'implementation', 'solved')),
  outcome            text check (outcome is null or char_length(outcome) <= 1000),
  addresses_post_id  uuid references posts(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  edited_at          timestamptz,
  constraint posts_problem_status check ((intent = 'problem') = (status is not null))
);
create index if not exists posts_created_idx on posts (created_at desc, id desc);
create index if not exists posts_author_idx on posts (author_id, created_at desc);
create index if not exists posts_category_idx on posts (category_id, created_at desc);
create index if not exists posts_open_problems_idx on posts (created_at desc) where intent = 'problem' and status <> 'solved';
create index if not exists posts_addresses_idx on posts (addresses_post_id) where addresses_post_id is not null;
create index if not exists posts_location_idx on posts (lower(btrim(location))) where location <> '';

create table if not exists post_lifecycle_updates (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  status      text not null check (status in ('unsolved', 'discussion', 'solutions', 'implementation', 'solved')),
  note        text not null check (char_length(note) between 1 and 500),
  actor_id    uuid references profiles(user_id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists lifecycle_post_idx on post_lifecycle_updates (post_id, created_at);

-- ───────────────────────── Media (Neon Object Storage references) ─────────────────────────
create table if not exists media (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(user_id) on delete cascade,
  purpose     text not null check (purpose in ('post', 'avatar')),
  kind        text not null check (kind in ('image', 'video')),
  bucket      text not null,
  object_key  text not null unique check (char_length(object_key) <= 300),
  mime        text not null,
  size_bytes  bigint not null check (size_bytes > 0),
  status      text not null default 'pending' check (status in ('pending', 'ready')),
  post_id     uuid references posts(id) on delete cascade,
  position    smallint not null default 0 check (position between 0 and 9),
  alt         text not null default '' check (char_length(alt) <= 200),
  created_at  timestamptz not null default now(),
  constraint media_post_purpose check (post_id is null or purpose = 'post')
);
create index if not exists media_post_idx on media (post_id, position) where post_id is not null;
create index if not exists media_owner_idx on media (owner_id, status, created_at);

do $$ begin
  alter table profiles add constraint profiles_avatar_fk foreign key (avatar_media_id) references media(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Objects whose rows were deleted but whose storage delete has not been confirmed yet.
create table if not exists storage_gc (
  object_key  text primary key,
  bucket      text not null,
  reason      text not null,
  queued_at   timestamptz not null default now(),
  attempts    int not null default 0,
  last_error  text
);

-- ───────────────────────── Post interactions ─────────────────────────
create table if not exists post_supports (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_supports_user_idx on post_supports (user_id);

create table if not exists post_cares (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_cares_user_idx on post_cares (user_id);

create table if not exists post_saves (
  user_id uuid not null references profiles(user_id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists post_saves_post_idx on post_saves (post_id);

create table if not exists post_hidden (
  user_id uuid not null references profiles(user_id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  channel text not null check (channel in ('link', 'device', 'message')),
  created_at timestamptz not null default now()
);
create index if not exists post_shares_post_idx on post_shares (post_id);
create index if not exists post_shares_user_idx on post_shares (user_id);

-- ───────────────────────── Solutions ─────────────────────────
create table if not exists solutions (
  id                uuid primary key default gen_random_uuid(),
  problem_id        uuid not null references posts(id) on delete cascade,
  author_id         uuid not null references profiles(user_id) on delete cascade,
  title             text not null check (char_length(title) between 8 and 160),
  summary           text not null check (char_length(summary) between 20 and 1000),
  approach          text[] not null check (cardinality(approach) between 1 and 20),
  resources         text[] not null default '{}' check (cardinality(resources) <= 20),
  funding_needed    bigint not null default 0 check (funding_needed between 0 and 10000000000),
  timeline          text not null default '' check (char_length(timeline) <= 80),
  phases            jsonb not null default '[]'::jsonb,
  expected_outcome  text not null check (char_length(expected_outcome) between 10 and 1000),
  evidence          text[] not null default '{}' check (cardinality(evidence) <= 20),
  stage             text not null default 'proposed' check (stage in ('proposed', 'reviewing', 'funding', 'implementing', 'completed')),
  outcome           text check (outcome is null or char_length(outcome) <= 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists solutions_problem_idx on solutions (problem_id);
create index if not exists solutions_author_idx on solutions (author_id, created_at desc);

create table if not exists solution_supports (
  solution_id uuid not null references solutions(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (solution_id, user_id)
);
create index if not exists solution_supports_user_idx on solution_supports (user_id);

create table if not exists solution_saves (
  user_id uuid not null references profiles(user_id) on delete cascade,
  solution_id uuid not null references solutions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, solution_id)
);

create table if not exists solution_skills (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references solutions(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  needed int not null default 2 check (needed between 1 and 1000),
  unique (solution_id, label)
);

create table if not exists solution_skill_members (
  skill_id uuid not null references solution_skills(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (skill_id, user_id)
);
create index if not exists skill_members_user_idx on solution_skill_members (user_id);

-- Pledges are commitments only. No payment is collected by RUHIZ.
create table if not exists solution_pledges (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references solutions(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  amount bigint not null check (amount between 1 and 1000000000),
  created_at timestamptz not null default now()
);
create index if not exists pledges_solution_idx on solution_pledges (solution_id);
create index if not exists pledges_user_idx on solution_pledges (user_id);

-- ───────────────────────── Structured discussion ─────────────────────────
create table if not exists contributions (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid references posts(id) on delete cascade,
  solution_id    uuid references solutions(id) on delete cascade,
  parent_id      uuid references contributions(id) on delete set null,
  author_id      uuid not null references profiles(user_id) on delete cascade,
  type           text not null check (type in ('experience', 'evidence', 'opinion', 'counter', 'question', 'solution', 'support')),
  body           text not null check (char_length(body) between 3 and 3000),
  source         text check (source is null or char_length(source) <= 300),
  identity_mode  text not null check (identity_mode in ('saver', 'revealer')),
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  constraint contributions_one_target check (num_nonnulls(post_id, solution_id) = 1)
);
create index if not exists contributions_post_idx on contributions (post_id, created_at) where post_id is not null;
create index if not exists contributions_solution_idx on contributions (solution_id, created_at) where solution_id is not null;
create index if not exists contributions_author_idx on contributions (author_id, created_at desc);
create index if not exists contributions_parent_idx on contributions (parent_id) where parent_id is not null;

create table if not exists contribution_helpful (
  contribution_id uuid not null references contributions(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contribution_id, user_id)
);

-- ───────────────────────── I Can Help ─────────────────────────
create table if not exists help_offers (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  user_id       uuid not null references profiles(user_id) on delete cascade,
  type          text not null check (type in ('knowledge','technical','research','funding','equipment','volunteering','local','professional','organization','other')),
  note          text not null check (char_length(note) between 5 and 500),
  availability  text not null check (availability in ('Today', 'This week', 'This month', 'Ongoing', 'One-time')),
  created_at    timestamptz not null default now(),
  unique (post_id, user_id, type)
);
create index if not exists help_offers_post_idx on help_offers (post_id, created_at desc);
create index if not exists help_offers_user_idx on help_offers (user_id, created_at desc);

-- ───────────────────────── People ─────────────────────────
create table if not exists user_supports (
  supporter_id uuid not null references profiles(user_id) on delete cascade,
  supported_id uuid not null references profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (supporter_id, supported_id),
  constraint user_supports_not_self check (supporter_id <> supported_id)
);
create index if not exists user_supports_supported_idx on user_supports (supported_id);

-- ───────────────────────── Messaging ─────────────────────────
create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  user_a           uuid not null references profiles(user_id) on delete cascade,
  user_b           uuid not null references profiles(user_id) on delete cascade,
  context          text check (context is null or char_length(context) <= 120),
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  constraint conversations_ordered check (user_a < user_b),
  unique (user_a, user_b)
);
create index if not exists conversations_a_idx on conversations (user_a, last_message_at desc nulls last);
create index if not exists conversations_b_idx on conversations (user_b, last_message_at desc nulls last);

create table if not exists conversation_reads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(user_id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id                      uuid primary key default gen_random_uuid(),
  conversation_id         uuid not null references conversations(id) on delete cascade,
  sender_id               uuid not null references profiles(user_id) on delete cascade,
  body                    text not null check (char_length(body) between 1 and 4000),
  attachment_post_id      uuid references posts(id) on delete set null,
  attachment_solution_id  uuid references solutions(id) on delete set null,
  created_at              timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages (conversation_id, created_at);

-- ───────────────────────── Notifications ─────────────────────────
create table if not exists notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(user_id) on delete cascade,
  actor_id         uuid not null references profiles(user_id) on delete cascade,
  type             text not null check (type in ('support', 'response', 'solution', 'message', 'help', 'status', 'supporter')),
  post_id          uuid references posts(id) on delete cascade,
  solution_id      uuid references solutions(id) on delete cascade,
  conversation_id  uuid references conversations(id) on delete cascade,
  created_at       timestamptz not null default now(),
  read_at          timestamptz,
  constraint notifications_not_self check (user_id <> actor_id)
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;

-- ───────────────────────── Emotional support ─────────────────────────
create table if not exists support_listings (
  user_id       uuid primary key references profiles(user_id) on delete cascade,
  listed        boolean not null default false,
  areas         text[] not null default '{}' check (cardinality(areas) <= 12),
  description   text not null default '' check (char_length(description) <= 500),
  languages     text[] not null default '{}' check (cardinality(languages) <= 10),
  hours         text not null default '' check (char_length(hours) <= 80),
  approach      text not null default '' check (char_length(approach) <= 200),
  availability  text not null default 'available' check (availability in ('available', 'busy', 'away')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists support_listings_listed_idx on support_listings (listed) where listed;

-- Licensed-professional credentials. Only an administrator can move status to 'verified'.
create table if not exists support_credentials (
  user_id              uuid primary key references profiles(user_id) on delete cascade,
  credential_type      text not null check (char_length(credential_type) between 2 and 80),
  issuing_body         text not null check (char_length(issuing_body) between 2 and 120),
  registration_number  text not null check (char_length(registration_number) between 2 and 60),
  status               text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note          text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by          uuid references profiles(user_id) on delete set null,
  reviewed_at          timestamptz,
  submitted_at         timestamptz not null default now()
);
create index if not exists support_credentials_status_idx on support_credentials (status, submitted_at);

-- ───────────────────────── Moderation ─────────────────────────
create table if not exists reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references profiles(user_id) on delete cascade,
  post_id           uuid references posts(id) on delete cascade,
  contribution_id   uuid references contributions(id) on delete cascade,
  solution_id       uuid references solutions(id) on delete cascade,
  reported_user_id  uuid references profiles(user_id) on delete cascade,
  reason            text not null check (reason in ('spam', 'harassment', 'hate', 'self-harm', 'misinformation', 'privacy', 'other')),
  details           text check (details is null or char_length(details) <= 500),
  status            text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by       uuid references profiles(user_id) on delete set null,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  constraint reports_one_target check (num_nonnulls(post_id, contribution_id, solution_id, reported_user_id) = 1)
);
create index if not exists reports_status_idx on reports (status, created_at desc);

-- Kept after the admin or target is deleted (no FKs), for accountability.
create table if not exists admin_audit_log (
  id             bigserial primary key,
  admin_user_id  uuid not null,
  admin_email    text not null,
  action         text not null,
  target_type    text not null,
  target_id      text not null,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on admin_audit_log (created_at desc);

create table if not exists rate_limits (
  bucket_key    text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (bucket_key, window_start)
);
create index if not exists rate_limits_window_idx on rate_limits (window_start);

-- ───────────────────────── Ranking / algorithm data ─────────────────────────
-- Denormalised per-post signals, maintained by triggers below.
create table if not exists post_stats (
  post_id                uuid primary key references posts(id) on delete cascade,
  supports               int not null default 0,
  cares                  int not null default 0,
  discussions            int not null default 0,
  shares                 int not null default 0,
  saves                  int not null default 0,
  help_offers            int not null default 0,
  solutions              int not null default 0,
  contribution_types     smallint not null default 0,
  last_activity_at       timestamptz not null default now(),
  last_status_change_at  timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists user_category_interest (
  user_id      uuid not null references profiles(user_id) on delete cascade,
  category_id  text not null references categories(id) on delete cascade,
  score        double precision not null default 0 check (score >= 0),
  updated_at   timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table if not exists user_kind_preference (
  user_id     uuid not null references profiles(user_id) on delete cascade,
  kind        text not null check (kind in ('photo', 'video', 'thought')),
  score       double precision not null default 0 check (score >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, kind)
);

create table if not exists interaction_events (
  id           bigserial primary key,
  user_id      uuid not null references profiles(user_id) on delete cascade,
  post_id      uuid references posts(id) on delete cascade,
  category_id  text not null references categories(id) on delete cascade,
  event_type   text not null check (event_type in ('author', 'support', 'unsupport', 'care', 'uncare', 'save', 'unsave', 'contribute', 'share', 'help', 'view', 'interest')),
  weight       real not null,
  created_at   timestamptz not null default now()
);
create index if not exists interaction_events_user_idx on interaction_events (user_id, created_at desc);
create index if not exists interaction_events_post_idx on interaction_events (post_id) where post_id is not null;

create table if not exists post_impressions (
  user_id        uuid not null references profiles(user_id) on delete cascade,
  post_id        uuid not null references posts(id) on delete cascade,
  impressions    int not null default 1,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ───────────────────────── Functions & triggers ─────────────────────────
create or replace function ruhiz_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles for each row execute function ruhiz_touch_updated_at();
drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts for each row execute function ruhiz_touch_updated_at();
drop trigger if exists solutions_touch on solutions;
create trigger solutions_touch before update on solutions for each row execute function ruhiz_touch_updated_at();
drop trigger if exists support_listings_touch on support_listings;
create trigger support_listings_touch before update on support_listings for each row execute function ruhiz_touch_updated_at();

create or replace function ruhiz_post_stats_init() returns trigger language plpgsql as $$
begin
  insert into post_stats (post_id, last_activity_at, last_status_change_at) values (new.id, new.created_at, new.created_at)
  on conflict (post_id) do nothing;
  return null;
end $$;
drop trigger if exists posts_stats_init on posts;
create trigger posts_stats_init after insert on posts for each row execute function ruhiz_post_stats_init();

-- Generic +1/-1 counter for interaction tables keyed by post_id. TG_ARGV[0] is a fixed column name.
create or replace function ruhiz_bump_post_stat() returns trigger language plpgsql as $$
declare
  col   text := tg_argv[0];
  pid   uuid;
  delta int;
begin
  if tg_op = 'INSERT' then pid := new.post_id; delta := 1; else pid := old.post_id; delta := -1; end if;
  execute format(
    'update post_stats set %1$I = greatest(%1$I + $1, 0), updated_at = now()%2$s where post_id = $2',
    col, case when delta > 0 and col <> 'saves' then ', last_activity_at = now()' else '' end
  ) using delta, pid;
  return null;
end $$;

drop trigger if exists post_supports_stat on post_supports;
create trigger post_supports_stat after insert or delete on post_supports for each row execute function ruhiz_bump_post_stat('supports');
drop trigger if exists post_cares_stat on post_cares;
create trigger post_cares_stat after insert or delete on post_cares for each row execute function ruhiz_bump_post_stat('cares');
drop trigger if exists post_saves_stat on post_saves;
create trigger post_saves_stat after insert or delete on post_saves for each row execute function ruhiz_bump_post_stat('saves');
drop trigger if exists post_shares_stat on post_shares;
create trigger post_shares_stat after insert or delete on post_shares for each row execute function ruhiz_bump_post_stat('shares');
drop trigger if exists help_offers_stat on help_offers;
create trigger help_offers_stat after insert or delete on help_offers for each row execute function ruhiz_bump_post_stat('help_offers');

create or replace function ruhiz_contribution_stats() returns trigger language plpgsql as $$
declare pid uuid;
begin
  if tg_op = 'DELETE' then pid := old.post_id; else pid := new.post_id; end if;
  if pid is null then return null; end if;
  update post_stats set
    discussions = (select count(*) from contributions where post_id = pid),
    contribution_types = (select count(distinct type) from contributions where post_id = pid),
    last_activity_at = case when tg_op = 'INSERT' then now() else last_activity_at end,
    updated_at = now()
  where post_id = pid;
  return null;
end $$;
drop trigger if exists contributions_stat on contributions;
create trigger contributions_stat after insert or delete on contributions for each row execute function ruhiz_contribution_stats();

create or replace function ruhiz_solution_stats() returns trigger language plpgsql as $$
declare pid uuid;
begin
  if tg_op = 'DELETE' then pid := old.problem_id; else pid := new.problem_id; end if;
  update post_stats set solutions = (select count(*) from solutions where problem_id = pid),
    last_activity_at = case when tg_op = 'INSERT' then now() else last_activity_at end, updated_at = now()
  where post_id = pid;
  return null;
end $$;
drop trigger if exists solutions_stat on solutions;
create trigger solutions_stat after insert or delete on solutions for each row execute function ruhiz_solution_stats();

create or replace function ruhiz_lifecycle_stats() returns trigger language plpgsql as $$
begin
  update post_stats set last_status_change_at = new.created_at, last_activity_at = now(), updated_at = now() where post_id = new.post_id;
  return null;
end $$;
drop trigger if exists lifecycle_stat on post_lifecycle_updates;
create trigger lifecycle_stat after insert on post_lifecycle_updates for each row execute function ruhiz_lifecycle_stats();

-- Interest scores decay 5% per week, applied lazily on every update. Never negative.
create or replace function ruhiz_add_interest(p_user uuid, p_category text, p_weight double precision) returns void language sql as $$
  insert into user_category_interest (user_id, category_id, score, updated_at)
  values (p_user, p_category, greatest(p_weight, 0), now())
  on conflict (user_id, category_id) do update set
    score = greatest(user_category_interest.score * power(0.95, extract(epoch from now() - user_category_interest.updated_at) / 604800.0) + p_weight, 0),
    updated_at = now();
$$;

create or replace function ruhiz_add_kind_pref(p_user uuid, p_kind text, p_weight double precision) returns void language sql as $$
  insert into user_kind_preference (user_id, kind, score, updated_at)
  values (p_user, p_kind, greatest(p_weight, 0), now())
  on conflict (user_id, kind) do update set
    score = greatest(user_kind_preference.score * power(0.95, extract(epoch from now() - user_kind_preference.updated_at) / 604800.0) + p_weight, 0),
    updated_at = now();
$$;

-- Records one interaction and updates the viewer's category + content-type preferences.
create or replace function ruhiz_record_event(p_user uuid, p_post uuid, p_event text, p_weight double precision) returns void language plpgsql as $$
declare v_cat text; v_kind text;
begin
  select category_id, kind into v_cat, v_kind from posts where id = p_post;
  if v_cat is null then return; end if;
  insert into interaction_events (user_id, post_id, category_id, event_type, weight) values (p_user, p_post, v_cat, p_event, p_weight);
  perform ruhiz_add_interest(p_user, v_cat, p_weight);
  perform ruhiz_add_kind_pref(p_user, v_kind, p_weight * 0.5);
end $$;
