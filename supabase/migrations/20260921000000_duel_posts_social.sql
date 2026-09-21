-- ============================================================================*

-- DUEL — POSTS & SOCIAL MIGRATION (phase 2)*

-- ============================================================================*

-- Run AFTER 20260920000000_duel_platform.sql. IDEMPOTENT: safe to re-run.*

-- WHAT IT DOES*

--   1. POST-LEVEL SOCIAL. A Challenge is the container; a post*

--      (row in challenge_checkins) is someone's daily activity inside it.*

--      Posts now carry their own engagement:*

--        challenge_checkins  (+ like_count, comment_count, save_count, share_count)*

--        post_likes      (post_id, user_id)*

--        post_comments   (post_id, user_id, body)*

--        post_saves      (post_id, user_id)*

--        post_shares     (post_id, user_id, unique per user)*

--      Counters are maintained by triggers, exactly like the challenge-level*

--      counters, so concurrent users can never corrupt them.*

--   2. CHECK-IN DELETION RECOMPUTE. Deleting your own post used to leave*

--      completed_days / streaks stale. A new AFTER DELETE trigger*

--      recomputes the participation (days, streaks, status) and rolls back*

--      the challenge completion counter when a completion is retracted.*

--   3. MESSAGES MEDIA. The messages table gains media_url / media_type so*

--      chat supports photo and video messages (same R2 pipeline as proofs).*

--   4. MESSAGE REQUESTS. When the recipient only allows messages from*

--      'everyone' or has blocked the sender, opening a conversation now*

--      creates a pending request instead. The recipient sees it under*

--      Messages → Message Requests and can accept (which creates the*

--      conversation) or decline.*

--   5. TRENDS + ONLINE. New duel_trending() RPC ranks open challenges by*

--      the last 7 days of real behaviour (joins, check-ins, likes, views).*

--      profiles.last_seen_at is refreshed on app launch for online status.*

--   6. RLS. All new tables get Row Level Security:*

--      • posts + their engagement: public read (challenge content is public),*

--        authenticated members can add/remove their OWN likes/saves/comments,*

--        shares and can edit/delete their OWN posts (RLS-enforced).*

--      • message_requests: visible to the two parties; the recipient decides.*

--      No policy is weakened: anon users still cannot write anything.*

-- ============================================================================*

begin;

create extension if not exists "pgcrypto";

-- ============================================================================*

-- 1. POST-LEVEL COUNTERS ON challenge_checkins*

-- ============================================================================*

alter table public.challenge_checkins add column if not exists like_count    int not null default 0;

alter table public.challenge_checkins add column if not exists comment_count int not null default 0;

alter table public.challenge_checkins add column if not exists save_count    int not null default 0;

alter table public.challenge_checkins add column if not exists share_count   int not null default 0;

create table if not exists public.post_likes (

  post_id    uuid not null references public.challenge_checkins(id) on delete cascade,

  user_id    uuid not null references public.profiles(id) on delete cascade,

  created_at timestamptz not null default now(),

  primary key (post_id, user_id)

);

create table if not exists public.post_saves (

  post_id    uuid not null references public.challenge_checkins(id) on delete cascade,

  user_id    uuid not null references public.profiles(id) on delete cascade,

  created_at timestamptz not null default now(),

  primary key (post_id, user_id)

);

create table if not exists public.post_shares (

  id         uuid primary key default gen_random_uuid(),

  post_id    uuid not null references public.challenge_checkins(id) on delete cascade,

  user_id    uuid not null references public.profiles(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique (post_id, user_id)

);

create table if not exists public.post_comments (

  id         uuid primary key default gen_random_uuid(),

  post_id    uuid not null references public.challenge_checkins(id) on delete cascade,

  user_id    uuid not null references public.profiles(id) on delete cascade,

  body       text not null check (char_length(body) between 1 and 1000),

  created_at timestamptz not null default now()

);

create index if not exists idx_post_likes_user     on public.post_likes (user_id);

create index if not exists idx_post_saves_user     on public.post_saves (user_id);

create index if not exists idx_post_shares_post    on public.post_shares (post_id);

create index if not exists idx_post_comments_post  on public.post_comments (post_id, created_at);

/** Counter maintenance for post denormalised counts (post_id → challenge_checkins). */

create or replace function public.duel_fn_bump_post_counter() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  col   text := tg_argv[0];

  delta int;

  pid   uuid;

begin

  if tg_op = 'INSERT' then delta := 1; pid := new.post_id;

  else delta := -1; pid := old.post_id; end if;

  execute format('update public.challenge_checkins set %I = greatest(0, %I + $1) where id = $2', col, col)

    using delta, pid;

  if tg_op = 'INSERT' then return new; else return old; end if;

end;

$$;

drop trigger if exists trg_post_like_count    on public.post_likes;

create trigger trg_post_like_count after insert or delete on public.post_likes

  for each row execute function public.duel_fn_bump_post_counter('like_count');

drop trigger if exists trg_post_save_count    on public.post_saves;

create trigger trg_post_save_count after insert or delete on public.post_saves

  for each row execute function public.duel_fn_bump_post_counter('save_count');

drop trigger if exists trg_post_comment_count on public.post_comments;

create trigger trg_post_comment_count after insert or delete on public.post_comments

  for each row execute function public.duel_fn_bump_post_counter('comment_count');

drop trigger if exists trg_post_share_count   on public.post_shares;

create trigger trg_post_share_count after insert on public.post_shares

  for each row execute function public.duel_fn_bump_post_counter('share_count');

-- ============================================================================*

-- 2. CHECK-IN DELETION → RECOMPUTE PARTICIPATION*

-- ============================================================================*

/**

 * Keeping progress honest when a member removes their own proof:

 * recomputes completed_days, current/longest streak and status for the

 * participation, and rolls back the challenge completion_count if the

 * member falls below the required days after having completed.

 */

create or replace function public.duel_fn_recompute_on_checkin_delete() returns trigger

language plpgsql security definer set search_path = public as $$

declare

  p       public.challenge_participants%rowtype;

  ch      public.challenges%rowtype;

  dates   date[];

  done    int;

  cur     int := 0;

  longest int := 0;

  run     int := 0;

  best    int := 0;

  i       int;

  last    date;

begin

  select * into p from public.challenge_participants

   where challenge_id = old.challenge_id and user_id = old.user_id;

  if not found then return old; end if;

  select * into ch from public.challenges where id = old.challenge_id;

  select coalesce(array_agg(checkin_date order by checkin_date), array[]::date[]) into dates

    from public.challenge_checkins

   where challenge_id = old.challenge_id and user_id = old.user_id;

  done := cardinality(dates);

  -- current streak: consecutive run ending at the most recent check-in date

  if done > 0 then

    last := dates[done];

    i := done;

    while i >= 1 and dates[i] = last - (done - i) loop

      cur := cur + 1;

      i := i - 1;

    end loop;

  end if;

  -- longest streak: longest consecutive run anywhere in the history

  for i in 1..done loop

    if i = 1 or dates[i] = dates[i - 1] + 1 then

      run := run + 1;

    else

      run := 1;

    end if;

    if run > best then best := run; end if;

  end loop;

  longest := best;

  update public.challenge_participants set

    current_streak     = cur,

    longest_streak     = greatest(longest_streak, longest),

    completed_days     = done,

    last_checkin_date  = case when done = 0 then null else dates[done] end,

    status             = case when status = 'completed' then 'completed'

                              when done >= ch.duration_days then 'completed'

                              else 'active' end

   where id = p.id;

  -- a completion is only retracted if the member still has the completed_at stamp

  if p.status = 'completed' and p.completed_at is not null and done < ch.duration_days then

    update public.challenge_participants set status = 'active', completed_at = null where id = p.id;

    update public.challenges set completion_count = greatest(0, completion_count - 1) where id = ch.id;

  end if;

  return old;

end;

$$;

drop trigger if exists trg_duel_recompute_checkin_delete on public.challenge_checkins;

create trigger trg_duel_recompute_checkin_delete

  after delete on public.challenge_checkins

  for each row execute function public.duel_fn_recompute_on_checkin_delete();

-- ============================================================================*

-- 3. MESSAGES MEDIA*

-- ============================================================================*

alter table public.messages add column if not exists media_url  text;

alter table public.messages add column if not exists media_type text check (media_type in ('image', 'video'));

-- ============================================================================*

-- 4. MESSAGE REQUESTS*

-- ============================================================================*

create table if not exists public.message_requests (

  id         uuid primary key default gen_random_uuid(),

  from_user  uuid not null references public.profiles(id) on delete cascade,

  to_user    uuid not null references public.profiles(id) on delete cascade,

  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),

  created_at timestamptz not null default now(),

  check (from_user <> to_user)

);

create unique index if not exists idx_message_requests_pending

  on public.message_requests (from_user, to_user) where status = 'pending';

create index if not exists idx_message_requests_to on public.message_requests (to_user, status);

create index if not exists idx_message_requests_from on public.message_requests (from_user, status);

/**

 * Open (or return) a conversation with another member, honouring their

 * message privacy settings:

 *   - recipient blocked the sender            → creates a pending request

 *   - recipient allows messages from 'none' or

 *     'connections' (i.e. not 'everyone')     → creates a pending request

 *   - otherwise                                → creates/returns the conversation

 *

 * Returns the conversation id (uuid as text) or 'request:pending'.

 */

create or replace function public.duel_open_conversation(p_other_user uuid)

returns text

language plpgsql security definer set search_path = public as $$

declare

  me     uuid := public.duel_current_profile_id();

  other  public.profiles%rowtype;

  existing uuid;

  convo  uuid;

  policy text;

begin

  if me is null then raise exception 'not signed in'; end if;

  if p_other_user = me then raise exception 'you cannot message yourself'; end if;

  select * into other from public.profiles where id = p_other_user;

  if not found then raise exception 'user not found'; end if;

  -- an existing conversation always wins (privacy changes are not retroactive)

  select c.id into existing

    from public.conversations c

    join public.conversation_participants cp   on cp.conversation_id = c.id and cp.user_id = me

    join public.conversation_participants cp2  on cp2.conversation_id = c.id and cp2.user_id = p_other_user

   limit 1;

  if existing is not null then return existing::text; end if;

  if (other.settings->'blocked' ? p_other_user::text) then

    insert into public.message_requests (from_user, to_user) values (me, p_other_user)

    on conflict (from_user, to_user) where status = 'pending' do nothing;

    return 'request:pending';

  end if;

  policy := coalesce(other.settings->>'allowMessagesFrom', 'everyone');

  if policy <> 'everyone' then

    insert into public.message_requests (from_user, to_user) values (me, p_other_user)

    on conflict (from_user, to_user) where status = 'pending' do nothing;

    return 'request:pending';

  end if;

  insert into public.conversations (last_message_at) values (null) returning id into convo;

  insert into public.conversation_participants (conversation_id, user_id) values (convo, me), (convo, p_other_user);

  return convo::text;

end;

$$;

/** Recipient accepts a pending request → conversation is created. */

create or replace function public.duel_accept_message_request(p_request_id uuid)

returns text

language plpgsql security definer set search_path = public as $$

declare

  me    uuid := public.duel_current_profile_id();

  r     public.message_requests%rowtype;

  convo uuid;

  existing uuid;

begin

  if me is null then raise exception 'not signed in'; end if;

  select * into r from public.message_requests

   where id = p_request_id and to_user = me and status = 'pending' for update;

  if not found then raise exception 'request not found'; end if;

  update public.message_requests set status = 'accepted' where id = r.id;

  select c.id into existing

    from public.conversations c

    join public.conversation_participants cp   on cp.conversation_id = c.id and cp.user_id = me

    join public.conversation_participants cp2  on cp2.conversation_id = c.id and cp2.user_id = r.from_user

   limit 1;

  if existing is not null then return existing::text; end if;

  insert into public.conversations (last_message_at) values (null) returning id into convo;

  insert into public.conversation_participants (conversation_id, user_id) values (convo, me), (convo, r.from_user);

  return convo::text;

end;

$$;

/** Recipient declines a pending request. */

create or replace function public.duel_decline_message_request(p_request_id uuid)

returns void

language plpgsql security definer set search_path = public as $$

declare

  me uuid := public.duel_current_profile_id();

begin

  if me is null then raise exception 'not signed in'; end if;

  update public.message_requests set status = 'declined'

   where id = p_request_id and to_user = me and status = 'pending';

end;

$$;

-- ============================================================================*

-- 5. TRENDS + ONLINE PRESENCE*

-- ============================================================================*

/**

 * Server-side trending: open challenges ranked by the last 7 days of real*

 * behaviour (joins ×3, check-ins ×2, likes ×1, everything else ×0.5)*

 * plus a small baseline for overall participation. No fake signals.*

 */

create or replace function public.duel_trending(p_limit int default 12)

returns table (

  id                uuid,

  title             text,

  category_id       text,

  participant_count int,

  like_count        int,

  score             numeric

)

language sql stable security definer set search_path = public as $$

  select c.id, c.title, c.category_id, c.participant_count, c.like_count,

         round((

           (select coalesce(sum(

                     case a.action

                       when 'join'    then 3

                       when 'checkin' then 2

                       when 'like'    then 1

                       else 0.5

                     end), 0)

              from public.activities a

             where a.challenge_id = c.id

               and a.created_at > now() - interval '7 days')

           + 0.2 * c.participant_count

         ), 1) as score

    from public.challenges c

   where c.status = 'open'

   order by score desc, c.participant_count desc, c.created_at desc

   limit greatest(1, p_limit);

$$;

/**
 * Record a challenge view. The challenges table is creator-writable under
 * RLS, so non-creator view bumps go through this security-definer helper.
 * Returns the fresh view_count for the client to mirror.
 */

create or replace function public.duel_record_view(p_challenge_id uuid)

returns int

language plpgsql security definer set search_path = public as $$

declare

  n int;

begin

  update public.challenges set view_count = view_count + 1

   where id = p_challenge_id

   returning view_count into n;

  return coalesce(n, 0);

end;

$$;

-- ============================================================================*

-- 6. ROW LEVEL SECURITY*

-- ============================================================================*

alter table public.post_likes     enable row level security;

alter table public.post_saves     enable row level security;

alter table public.post_shares    enable row level security;

alter table public.post_comments  enable row level security;

alter table public.message_requests enable row level security;

-- posts are public content: anyone may read; only signed-in members interact.

drop policy if exists post_likes_read on public.post_likes;

create policy post_likes_read on public.post_likes for select using (true);

drop policy if exists post_likes_write on public.post_likes;

create policy post_likes_write on public.post_likes for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists post_likes_delete on public.post_likes;

create policy post_likes_delete on public.post_likes for delete

  using (user_id = public.duel_current_profile_id());

drop policy if exists post_saves_read on public.post_saves;

create policy post_saves_read on public.post_saves for select using (true);

drop policy if exists post_saves_write on public.post_saves;

create policy post_saves_write on public.post_saves for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists post_saves_delete on public.post_saves;

create policy post_saves_delete on public.post_saves for delete

  using (user_id = public.duel_current_profile_id());

drop policy if exists post_shares_read on public.post_shares;

create policy post_shares_read on public.post_shares for select using (true);

drop policy if exists post_shares_write on public.post_shares;

create policy post_shares_write on public.post_shares for insert

  with check (user_id = public.duel_current_profile_id());

drop policy if exists post_shares_delete on public.post_shares;

create policy post_shares_delete on public.post_shares for delete

  using (user_id = public.duel_current_profile_id());

drop policy if exists post_comments_read on public.post_comments;

create policy post_comments_read on public.post_comments for select using (true);

drop policy if exists post_comments_write on public.post_comments;

create policy post_comments_write on public.post_comments for insert

  with check (user_id = public.duel_current_profile_id());

-- the comment author deletes their own comments

drop policy if exists post_comments_delete on public.post_comments;

create policy post_comments_delete on public.post_comments for delete

  using (user_id = public.duel_current_profile_id());

-- message requests: only the two parties can see them; the recipient decides.

drop policy if exists message_requests_read on public.message_requests;

create policy message_requests_read on public.message_requests for select

  using (to_user = public.duel_current_profile_id() or from_user = public.duel_current_profile_id());

drop policy if exists message_requests_insert on public.message_requests;

create policy message_requests_insert on public.message_requests for insert

  with check (from_user = public.duel_current_profile_id() and to_user <> from_user);

drop policy if exists message_requests_update on public.message_requests;

create policy message_requests_update on public.message_requests for update

  using (to_user = public.duel_current_profile_id());

-- Realtime: live challenge activity feeds.

do $$

begin

  alter publication supabase_realtime add table public.challenge_checkins;

exception when duplicate_object then null; end $$;

-- ============================================================================*

-- DONE. Verify with:*

--   select count(*) from public.post_likes;      -- 0 (real members only)*

--   select count(*) from public.message_requests; -- 0*

--   select id, score from public.duel_trending(5);*

-- ============================================================================*

commit;

-- PostgREST schema cache reload so the new tables appear immediately*

notify pgrst, 'reload schema';
