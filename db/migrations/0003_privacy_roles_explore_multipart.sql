-- 0003: identity privacy, explicit admin roles, post-deletion audit, profile banners,
-- multipart video uploads and Explore discovery keys.
-- Additive only. The one data change makes accounts MORE private: any account marked
-- "revealer" without a consented reveal (revealed_at) goes back to hidden.

-- ───────── Identity reveal consent ─────────
alter table profiles add column if not exists revealed_at timestamptz;
update profiles set identity_mode = 'saver' where identity_mode = 'revealer' and revealed_at is null;
do $$ begin
  alter table profiles add constraint profiles_reveal_complete check (
    identity_mode = 'saver'
    or (revealed_at is not null and char_length(btrim(revealed_name)) >= 2 and char_length(btrim(revealed_role)) >= 2 and char_length(btrim(bio)) >= 10)
  );
exception when duplicate_object then null; end $$;

-- System-written lifecycle notes used to embed the actor's #CODE, which could link an
-- Identity Saver post to its author. Replace only those exact generated sentences.
update post_lifecycle_updates set note = 'Problem raised.' where note ~ '^Problem raised by #[A-Z0-9]{6}\.$';
update post_lifecycle_updates set note = 'Discussion started.' where note ~ '^Discussion started by #[A-Z0-9]{6}\.$';
update post_lifecycle_updates set note = 'A member proposed a solution in the discussion.' where note ~ '^#[A-Z0-9]{6} proposed a solution in the discussion\.$';
update post_lifecycle_updates set note = regexp_replace(note, '^#[A-Z0-9]{6} moved this to ', 'Moved to ') where note ~ '^#[A-Z0-9]{6} moved this to ';

-- ───────── Explicit roles (replaces the hard-coded email allowlist) ─────────
create table if not exists user_roles (
  user_id     uuid not null references neon_auth."user"(id) on delete cascade,
  role        text not null check (role in ('admin')),
  granted_at  timestamptz not null default now(),
  granted_by  text not null,
  primary key (user_id, role)
);

-- Grant the two authorised administrators, only if the account exists and its email is verified.
-- An account that does not exist yet is granted later with: npm run admin:grant -- <email>
insert into user_roles (user_id, role, granted_by)
select u.id, 'admin', 'migration 0003'
  from neon_auth."user" u
 where lower(u.email) in ('mohammadasimsaad@gmail.com', 'owaisarif555@gmail.com') and u."emailVerified"
on conflict do nothing;

-- ───────── Post deletion audit (owner vs administrator) ─────────
-- No FKs and no post content: the record survives the post and stores nothing private.
create table if not exists post_deletion_log (
  id          bigserial primary key,
  post_id     uuid not null,
  author_id   uuid not null,
  deleted_by  uuid not null,
  actor_kind  text not null check (actor_kind in ('owner', 'admin')),
  reason      text check (reason is null or char_length(reason) <= 300),
  media_count int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists post_deletion_log_created_idx on post_deletion_log (created_at desc);

-- ───────── Profile banner ─────────
alter table media drop constraint if exists media_purpose_check;
alter table media add constraint media_purpose_check check (purpose in ('post', 'avatar', 'banner'));
alter table profiles add column if not exists banner_media_id uuid;
do $$ begin
  alter table profiles add constraint profiles_banner_fk foreign key (banner_media_id) references media(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ───────── Multipart uploads ─────────
alter table media add column if not exists upload_id text check (upload_id is null or char_length(upload_id) <= 1024);
alter table media add column if not exists part_size int check (part_size is null or part_size between 5242880 and 104857600);
create index if not exists media_pending_idx on media (created_at) where status = 'pending';

-- ───────── Explore: randomised discovery ─────────
-- A random key per post. Explore starts at a per-visit random point on this key and walks the
-- index (wrapping once), so pages never repeat and no query sorts the whole table.
alter table posts add column if not exists shuffle_key double precision not null default random();
create index if not exists posts_shuffle_idx on posts (shuffle_key, id);
create index if not exists posts_cat_shuffle_idx on posts (category_id, shuffle_key, id);
create index if not exists posts_kind_shuffle_idx on posts (kind, shuffle_key, id);
create index if not exists posts_cat_kind_shuffle_idx on posts (category_id, kind, shuffle_key, id);
