# Ruhiz messaging debugging report

## Finding

The repository's production schema is explicit: `public.messages.sender_id`
references `public.profiles.id`. There is no `messages.user_id` column and the
frontend must not invent one.

The old SQL migration used the generic `public.fn_notify()` trigger for
multiple tables. That function referenced `NEW.user_id` for social rows while
also being attached to `messages`, whose row has `sender_id`. This is the
source of the reported PostgreSQL error:

```text
record "new" has no field "user_id"
```

The old diagnosis that this was an RLS policy problem was incorrect. RLS
policies can refer to table columns, but they do not use trigger `NEW` records;
the error explicitly identifies a PL/pgSQL trigger function.

## Changes made

1. Added `supabase/migrations/20260914000000_fix_message_trigger_schema.sql`.
   It splits message notifications into `fn_notify_message()`, removes message
   triggers attached to the shared function, recreates one canonical
   `trg_notify_message`, and preserves the real `sender_id` schema.
2. Updated the complete production migration so a fresh install gets the same
   isolated trigger design.
3. Kept RLS enabled and recreated the secure message policies:
   - SELECT: authenticated participants only;
   - INSERT: authenticated participant whose `sender_id` is their own profile;
   - DELETE: sender only.
   Read status remains on `conversation_participants.last_read_at` and is
   updated by the existing `mark_conversation_read()` function.
4. Updated the browser send flow to call `supabase.auth.getUser()`, resolve the
   corresponding `profiles.id`, and insert with `sender_id`. Failed optimistic
   messages are removed instead of being presented as sent.
5. Added `supabase/diagnose_messaging_readonly.sql`, one consolidated,
   read-only script covering columns, foreign keys, triggers/functions, RLS,
   grants, and Realtime publication state.

## Realtime design

Persisted messages use Supabase `postgres_changes` on `public.messages`.
Realtime Broadcast is not used to deliver message rows; it is separate UI
support for typing/presence. The message table is included in the
`supabase_realtime` publication and participant SELECT RLS controls which
clients can receive rows.

## API key investigation

A repository-wide search found no direct `/rest/v1/` call, custom Supabase
fetch, Axios request, or browser service-role key. Browser Auth/database calls
come from `lib/supabase/client.ts`; server routes use
`lib/supabase/server.ts`; browser `fetch` is only used for same-origin R2
media routes. Consequently, the `No API key found in request` response is not
from a hand-written messaging request in this checkout. The exact URL must be
identified from the browser Network panel; normal requests created by the
configured Supabase client carry the anon key automatically.

## Verification status

`npm run build` passes after the changes. This checkout has no production
Supabase credentials, no database connection, and no second authenticated
browser session, so a real two-user production send/receive/persistence test
could not be executed inside the sandbox. Apply the new migration, then use the
read-only diagnostic if the live database still reports a trigger not shown in
the repository migration.
