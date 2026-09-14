-- ============================================================================
-- RUHIZ HOTFIX — Moment/post inserts failing with:
--   "new row violates row-level security policy for table \"post_problems\""
--   (SQLSTATE 42501 — the whole INSERT INTO public.posts rolls back)
-- ============================================================================
-- ROOT CAUSE
--   public.fn_classify_post() — the AFTER INSERT/UPDATE trigger on public.posts
--   that maintains the derived classification table public.post_problems — was
--   created WITHOUT `security definer`. Every other maintenance trigger in the
--   schema (fn_bump_counter, fn_notify, fn_notify_message, fn_notify_mentions)
--   is SECURITY DEFINER; this one was missed.
--
--   post_problems has RLS enabled with a select-only policy (it is trigger-
--   maintained derived data — users must never write it directly). So when an
--   authenticated member posts a Moment, the trigger executes as that member's
--   `authenticated` role, the INSERT INTO post_problems hits RLS with no
--   matching WITH CHECK policy, raises 42501, and PostgreSQL rolls back the
--   entire post insert. Text, photo and video posts all fail identically.
--   (Seed content inserted by the migration itself worked only because
--   migrations run as `postgres`, the table owner, which bypasses RLS.)
--
-- FIX (no security is weakened)
--   1. Recreate fn_classify_text / fn_classify_post as SECURITY DEFINER with a
--      pinned search_path — the trusted-function pattern already used by every
--      other trigger here. RLS stays ENABLED everywhere and post_problems
--      remains read-only to users; direct user writes still fail with 42501.
--   2. Re-attach the canonical trg_classify_post trigger.
--   3. Backfill classification rows for every existing post (previous inserts
--      either rolled back or silently no-op'd the delete step under RLS).
--
-- IDEMPOTENT: safe to run multiple times, on fresh or already-fixed databases.
-- ============================================================================

begin;

-- 1) Trusted classifier helpers (bodies identical to the production migration)
create or replace function public.fn_classify_text(p_content text, p_topics text[])
returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
returns trigger language plpgsql security definer set search_path = public as $$
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

-- Execute grants (trigger firing does not require EXECUTE, but keep the
-- definer helpers callable exactly like the other schema helpers).
grant execute on function public.fn_classify_text(text, text[]) to authenticated, service_role;
grant execute on function public.fn_classify_post()             to authenticated, service_role;

-- 2) Canonical trigger attachment
drop trigger if exists trg_classify_post on public.posts;
create trigger trg_classify_post
  after insert or update of content, topics on public.posts
  for each row execute procedure public.fn_classify_post();

-- 3) Backfill derived classification for all existing posts (deterministic;
--    re-running simply upserts the same scores).
insert into public.post_problems (post_id, problem_id, score)
select p.id, e.key, e.value::real
from public.posts p
cross join lateral jsonb_each_text(public.fn_classify_text(p.content, p.topics)) as e
on conflict (post_id, problem_id) do update set score = excluded.score;

-- 4) Verify: the trigger function must be SECURITY DEFINER with pinned search_path
do $$
declare
  v_def boolean;
  v_cfg text[];
begin
  select p.prosecdef, p.proconfig into v_def, v_cfg
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'fn_classify_post';

  if not coalesce(v_def, false) then
    raise exception 'fn_classify_post is still not SECURITY DEFINER — Moment inserts will keep failing';
  end if;
  if 'search_path=public' <> all (coalesce(v_cfg, '{}')) then
    raise exception 'fn_classify_post is missing a pinned search_path';
  end if;
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'posts' and t.tgname = 'trg_classify_post' and not t.tgisinternal
  ) then
    raise exception 'trg_classify_post is not attached to public.posts';
  end if;

  raise notice '✅ Post classification trigger fixed — Moment/photo/video inserts now save under RLS';
  raise notice '🔒 RLS remains enabled on every table; post_problems is still user read-only';
end $$;

commit;
