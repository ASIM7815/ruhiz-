-- Ruhiz messaging diagnostic (READ ONLY)
-- Run this single script in the Supabase SQL Editor.
-- It does not alter tables, policies, triggers, functions, RLS, or Realtime.
-- Review each result set, especially the trigger/function output.

-- 1. Exact messages schema and indexes
select
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'messages'
order by c.ordinal_position;

select
  i.relname as index_name,
  pg_get_indexdef(i.oid) as index_definition
from pg_class i
join pg_index ix on ix.indexrelid = i.oid
join pg_class t on t.oid = ix.indrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'messages'
order by i.relname;

-- 2. All foreign keys touching the messaging tables
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema as referenced_schema,
  ccu.table_name as referenced_table,
  ccu.column_name as referenced_column,
  rc.update_rule,
  rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_schema = tc.constraint_schema
 and kcu.constraint_name = tc.constraint_name
 and kcu.table_name = tc.table_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_schema = tc.constraint_schema
 and ccu.constraint_name = tc.constraint_name
join information_schema.referential_constraints rc
  on rc.constraint_schema = tc.constraint_schema
 and rc.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('messages', 'conversation_participants', 'conversations')
order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 3. Every trigger on messages, including the exact function it executes
select
  n.nspname as table_schema,
  c.relname as table_name,
  t.tgname as trigger_name,
  case when t.tgenabled = 'D' then 'DISABLED' else 'ENABLED' end as trigger_status,
  pg_get_triggerdef(t.oid, true) as trigger_definition,
  pn.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as function_arguments,
  pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where n.nspname = 'public'
  and c.relname = 'messages'
  and not t.tgisinternal
order by t.tgname;

-- 4. Find every installed trigger function whose source references NEW.user_id.
-- This is the direct diagnostic for the reported error.  A messages trigger
-- must not execute a function containing that field reference for a messages row.
select
  pn.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as function_arguments,
  pg_get_functiondef(p.oid) as function_definition,
  exists (
    select 1
    from pg_trigger t
    where t.tgfoid = p.oid
      and not t.tgisinternal
  ) as is_used_by_a_trigger,
  coalesce(
    (
      select string_agg(format('%I.%I', tn.nspname, tc.relname) || ':' || tt.tgname, ', ')
      from pg_trigger tt
      join pg_class tc on tc.oid = tt.tgrelid
      join pg_namespace tn on tn.oid = tc.relnamespace
      where tt.tgfoid = p.oid
        and not tt.tgisinternal
    ),
    ''
  ) as attached_triggers
from pg_proc p
join pg_namespace pn on pn.oid = p.pronamespace
where pn.nspname = 'public'
  and lower(pg_get_functiondef(p.oid)) like '%new.user_id%'
order by p.proname;

-- 5. RLS state and every policy on the three messaging tables
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('messages', 'conversation_participants', 'conversations')
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in ('messages', 'conversation_participants', 'conversations')
order by tablename, policyname;

-- 6. Relevant function definitions and grants
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as function_arguments,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_profile_id',
    'is_conversation_participant',
    'get_or_create_conversation',
    'mark_conversation_read',
    'fn_touch_conversation',
    'fn_persona_autoreply',
    'fn_notify',
    'fn_notify_message'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 7. Realtime publication and replica identity
select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('messages', 'conversation_participants', 'conversations', 'notifications')
order by tablename;

select
  n.nspname as schema_name,
  c.relname as table_name,
  case c.relreplident
    when 'd' then 'DEFAULT'
    when 'n' then 'NOTHING'
    when 'f' then 'FULL'
    when 'i' then 'INDEX'
    else c.relreplident::text
  end as replica_identity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('messages', 'conversation_participants', 'conversations', 'notifications')
order by c.relname;

-- 8. Realtime Broadcast authorization policies, if present
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
order by policyname;

-- 9. Non-mutating identity and privilege context (useful when run as a user)
select
  current_user as sql_role,
  auth.uid() as auth_user_id,
  to_regclass('public.messages') is not null as messages_table_exists,
  has_table_privilege(current_user, 'public.messages', 'SELECT') as can_select_messages,
  has_table_privilege(current_user, 'public.messages', 'INSERT') as can_insert_messages;
