-- ============================================================================
-- DUEL MIGRATION PRE-FLIGHT INSPECTION  (read-only — changes nothing)
-- ============================================================================
-- Run this FIRST, in the Supabase SQL Editor, before applying
--   supabase/migrations/20260920000000_duel_platform.sql
--
-- It reports exactly what exists today, what the DUEL migration PRESERVES
-- (auth.users, profiles, conversations, messages) and what it DELETES
-- (posts, mental-health taxonomy, old recommendation state, old
-- notifications). Tables that never existed are reported as 0 rows.
-- Copy the output into your change log.
-- ============================================================================

create or replace function public.duel_preflight_count(p_table text) returns bigint
language plpgsql stable as $$
declare n bigint;
begin
  if to_regclass(p_table) is null then return 0; end if;
  execute format('select count(*) from %s', p_table) into n;
  return n;
end;
$$;

select '--- PRESERVED -------------------------------------------------' as report
union all select format('auth users (preserved): %s', count(*)) from auth.users
union all select format('profiles incl. personas (preserved): %s', count(*)) from public.profiles
union all select format('real member profiles (preserved): %s', count(*)) from public.profiles where user_id is not null
union all select format('conversations (preserved): %s', public.duel_preflight_count('public.conversations'))
union all select format('messages (preserved): %s', public.duel_preflight_count('public.messages'))
union all select '--- DELETED BY THE MIGRATION ----------------------------------'
union all select format('posts: %s', public.duel_preflight_count('public.posts'))
union all select format('post classifications (keyword classifier): %s', public.duel_preflight_count('public.post_problems'))
union all select format('post supports/likes: %s', public.duel_preflight_count('public.post_supports'))
union all select format('post saves: %s', public.duel_preflight_count('public.post_saves'))
union all select format('been_there marks: %s', public.duel_preflight_count('public.been_there'))
union all select format('post comments: %s', public.duel_preflight_count('public.comments'))
union all select format('mental-health categories (problems): %s', public.duel_preflight_count('public.problems'))
union all select format('old activity events: %s', public.duel_preflight_count('public.activities'))
union all select format('old recommendation scores: %s', public.duel_preflight_count('public.user_problem_scores'))
union all select format('support graph: %s', public.duel_preflight_count('public.supporters'))
union all select format('blocks: %s', public.duel_preflight_count('public.blocks'))
union all select format('old notifications: %s', public.duel_preflight_count('public.notifications'))
union all select '--- ALREADY DUEL (safe re-run) --------------------------------'
union all select format('duel categories: %s', public.duel_preflight_count('public.duel_categories'))
union all select format('challenges: %s', public.duel_preflight_count('public.challenges'))
union all select format('recommendations: %s', public.duel_preflight_count('public.recommendations'));

-- personas whose bios will be rewritten to DUEL copy
select id, username, display_name, is_persona, left(coalesce(bio, ''), 60) as current_bio
  from public.profiles
 where is_persona
 order by username;

-- R2 media keys referenced by old rows (objects are NOT deleted by the
-- migration; clean the bucket manually afterwards if you want them gone)
select 'post image keys (orphaned after migration)' as item,
       case when to_regclass('public.posts') is null then 0
            else (select count(*) from public.posts where image_url is not null and image_url not like 'http%') end as rows
 union all
select 'post video keys (orphaned after migration)',
       case when to_regclass('public.posts') is null then 0
            else (select count(*) from public.posts where video_url is not null and video_url not like 'http%') end
 union all
select 'avatar keys (preserved with profiles)',
       (select count(*) from public.profiles where avatar_url is not null and avatar_url not like 'http%');

-- old triggers the migration drops
select tgname as trigger_name, c.relname as on_table
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal
   and tgname in (
     'trg_classify_post','trg_support_count','trg_comment_count','trg_save_count',
     'trg_beenthere_count','trg_activities_scores','trg_notify_support',
     'trg_notify_comment','trg_notify_message','trg_notify_mention')
 order by 1;

drop function if exists public.duel_preflight_count(text);

-- ============================================================================
-- BACKUP ADVICE: snapshot what you are about to delete before migrating:
--   create table backup_legacy_posts as select * from public.posts;
--   create table backup_legacy_comments as select * from public.comments;
--   create table backup_legacy_activities as select * from public.activities;
-- (or use Supabase dashboard → Database → Backups / pg_dump)
-- ============================================================================
