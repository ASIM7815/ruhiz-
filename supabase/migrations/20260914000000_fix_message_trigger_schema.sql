-- Ruhiz messaging hotfix: isolate message triggers from social row shapes.
--
-- The messages table uses sender_id, not user_id.  Older deployments attached
-- public.fn_notify() to messages.  That shared trigger function also referenced
-- NEW.user_id for post_supports/comments, which makes a messages INSERT fail
-- with: record "new" has no field "user_id".
--
-- This migration is safe to run against the existing production schema:
-- it never disables RLS, does not add a fake user_id column, and recreates
-- one canonical message notification trigger.

begin;

-- Keep the helper aligned with the production identity model.  messages.sender_id
-- is a profiles.id; profiles.user_id is the authenticated auth.users.id.
create or replace function public.current_profile_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_profile_id() to authenticated;

create or replace function public.is_conversation_participant(
  p_conversation uuid,
  p_user uuid
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.conversation_participants cp
     where cp.conversation_id = p_conversation
       and cp.user_id = p_user
  );
$$;

grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

-- Social notifications retain their own row shape.  This function is not
-- attached to public.messages.
create or replace function public.fn_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_actor uuid;
  v_post uuid;
begin
  if coalesce(current_setting('app.seed_mode', true), '') = 'on' then
    return null;
  end if;

  if tg_table_name = 'post_supports' then
    v_actor := new.user_id;
    select p.user_id, p.id
      into v_recipient, v_post
      from public.posts p
     where p.id = new.post_id;
    if v_recipient is not null and v_recipient <> v_actor then
      insert into public.notifications (user_id, actor_id, kind, post_id)
      values (v_recipient, v_actor, 'support', v_post);
    end if;
  elsif tg_table_name = 'comments' then
    v_actor := new.user_id;
    select p.user_id, p.id
      into v_recipient, v_post
      from public.posts p
     where p.id = new.post_id;
    if v_recipient is not null and v_recipient <> v_actor then
      insert into public.notifications (user_id, actor_id, kind, post_id, body)
      values (v_recipient, v_actor, 'comment', v_post, left(new.content, 140));
    end if;
  elsif tg_table_name = 'supporters' then
    v_actor := new.supporter_id;
    v_recipient := new.supported_id;
    if v_recipient is not null and v_recipient <> v_actor then
      insert into public.notifications (user_id, actor_id, kind)
      values (v_recipient, v_actor, 'person_support');
    end if;
  end if;

  return null;
end;
$$;

-- This trigger function only accesses columns that exist on messages.
create or replace function public.fn_notify_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  if coalesce(current_setting('app.seed_mode', true), '') = 'on' then
    return null;
  end if;

  for v_recipient in
    select cp.user_id
      from public.conversation_participants cp
     where cp.conversation_id = new.conversation_id
       and cp.user_id <> new.sender_id
  loop
    insert into public.notifications (
      user_id, actor_id, kind, conversation_id, body
    )
    values (
      v_recipient, new.sender_id, 'message', new.conversation_id,
      left(new.content, 140)
    );
  end loop;

  return null;
end;
$$;

grant execute on function public.fn_notify_message() to authenticated;

-- Remove message triggers that use the known shared function, or any stale
-- trigger function whose source references NEW.user_id, regardless of the old
-- trigger name. Then install exactly one canonical notification trigger. This
-- prevents duplicate notifications without touching unrelated message
-- triggers (conversation timestamping and persona replies).
do $$
declare
  trigger_row record;
begin
  for trigger_row in
    select t.tgname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
     where n.nspname = 'public'
       and c.relname = 'messages'
       and not t.tgisinternal
       and (
         p.proname = 'fn_notify'
         or lower(pg_get_functiondef(p.oid)) like '%new.user_id%'
       )
  loop
    execute format('drop trigger if exists %I on public.messages', trigger_row.tgname);
  end loop;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message
after insert on public.messages
for each row execute function public.fn_notify_message();

-- Canonical conversation and message RLS.  RLS remains enabled throughout
-- this migration.  Remove old policies on only these messaging tables so an
-- earlier hotfix cannot leave a conflicting permissive policy behind.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('conversations', 'conversation_participants', 'messages')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end;
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

grant select, insert, delete on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant select, update on public.conversation_participants to authenticated;
grant select on public.conversations to authenticated;

create policy conversations_select on public.conversations
  for select to authenticated
  using (
    public.is_conversation_participant(id, public.current_profile_id())
  );

create policy cp_select on public.conversation_participants
  for select to authenticated
  using (
    public.is_conversation_participant(conversation_id, public.current_profile_id())
  );

create policy cp_insert on public.conversation_participants
  for insert to authenticated
  with check (user_id = public.current_profile_id());

create policy cp_update on public.conversation_participants
  for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_conversation_participant(
      conversation_id,
      public.current_profile_id()
    )
  );

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = public.current_profile_id()
    and public.is_conversation_participant(
      conversation_id,
      public.current_profile_id()
    )
  );

create policy messages_delete on public.messages
  for delete to authenticated
  using (sender_id = public.current_profile_id());

-- The current messages schema has no read/delivered/edited columns, so it has
-- no message UPDATE operation.  Read status is stored on
-- conversation_participants.last_read_at and updated only by the existing
-- mark_conversation_read() SECURITY DEFINER function / cp_update policy.

-- Realtime uses postgres_changes for persisted messages.  Keep the publication
-- explicit and idempotent; typing/presence remain separate Broadcast features.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication is not available; enable it in Supabase before using postgres_changes';
end;
$$;

commit;
