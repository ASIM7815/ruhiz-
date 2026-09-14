-- DEPRECATED: do not run this legacy script.
--
-- Earlier versions of this file disabled RLS and recreated policies without
-- fixing the trigger that caused `record "new" has no field "user_id"`.
-- Disabling RLS is not an acceptable messaging fix.
--
-- Apply the idempotent migration instead:
--   supabase/migrations/20260914000000_fix_message_trigger_schema.sql
--
-- To inspect production without changing it, run:
--   supabase/diagnose_messaging_readonly.sql
--
-- This file intentionally performs no database changes.
select
  'Use supabase/migrations/20260914000000_fix_message_trigger_schema.sql; this legacy script is retired.'::text
  as migration_required;
