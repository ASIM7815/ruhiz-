# Ruhiz messaging trigger fix

## Root cause found in the repository

The production `messages` schema uses `sender_id`:

```sql
messages(
  id,
  conversation_id,
  sender_id,
  content,
  created_at
)
```

The old migration attached the shared `public.fn_notify()` trigger function to
`messages`. That function also contained `NEW.user_id` references for the
`post_supports` and `comments` row shapes. A `messages` row does not have a
`user_id`, so the insert could fail with:

```text
record "new" has no field "user_id"
```

This is a database trigger/function row-shape mismatch. It is not caused by
Supabase Realtime being disabled, and changing the client to send `user_id`
would be wrong.

## Fix

Apply this migration in Supabase SQL Editor:

```text
supabase/migrations/20260914000000_fix_message_trigger_schema.sql
```

It:

- keeps `messages.sender_id` as the real sender column;
- replaces the shared message trigger with `fn_notify_message()`, which only
  reads `conversation_id`, `sender_id`, and `content`;
- removes old message triggers that were attached to `fn_notify()` and installs
  exactly one `trg_notify_message` trigger;
- leaves RLS enabled and recreates participant-only SELECT, sender-only INSERT,
  and sender-only DELETE policies;
- keeps `messages` in `supabase_realtime` for `postgres_changes`;
- does not add a fake `user_id` column or disable RLS.

For a read-only report of the live database, run the single script:

```text
supabase/diagnose_messaging_readonly.sql
```

## Frontend flow after the fix

`lib/store.tsx` now resolves the current user with
`supabase.auth.getUser()`, looks up that user's `profiles.id`, and inserts:

```ts
{
  conversation_id: threadId,
  sender_id: authenticatedProfileId,
  content: messageText,
}
```

It never uses a username, demo identity, or stale profile identity as the
sender. Messages are persisted with Supabase and received through the single
persisted-message channel:

```text
postgres_changes → public.messages INSERT
```

Broadcast remains separate from message persistence and is used only for the
optional typing/presence UI.

## API-key investigation

There is no direct `/rest/v1/` request, custom Supabase `fetch`, or Axios call
in the repository. All browser database/auth traffic goes through the singleton
configured in `lib/supabase/client.ts`; server routes use
`lib/supabase/server.ts`. The only browser `fetch` calls are same-origin Ruhiz
routes for R2 media upload/signing.

Therefore a `No API key found in request` response is not produced by a
hand-written messaging request in this checkout. It must be identified in the
browser Network panel by its request URL. A normal Supabase client request
created by this code includes the configured anon key automatically. The
read-only diagnostic and the migration do not require or expose a service-role
key.
