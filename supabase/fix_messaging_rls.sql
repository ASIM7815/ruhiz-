-- DEPRECATED: do not run this policy-only script.
--
-- RLS is part of the canonical hotfix, but it is not the source of
-- `record "new" has no field "user_id"`. That error is raised by the old
-- shared notification trigger attached to public.messages.
--
-- Apply the complete idempotent migration instead:
--   supabase/migrations/20260914000000_fix_message_trigger_schema.sql
--
-- Read-only inspection:
--   supabase/diagnose_messaging_readonly.sql
select
  'Use supabase/migrations/20260914000000_fix_message_trigger_schema.sql; this legacy script is retired.'::text
  as migration_required;
