-- DEPRECATED: do not run this legacy script.
--
-- This script used to replace policies with an insecure broad INSERT policy
-- and did not repair the trigger/function row-shape mismatch. It is retained
-- only as a pointer so it cannot be mistaken for the production fix.
--
-- Apply the idempotent migration instead:
--   supabase/migrations/20260914000000_fix_message_trigger_schema.sql
--
-- For a non-mutating production inspection:
--   supabase/diagnose_messaging_readonly.sql
select
  'Use supabase/migrations/20260914000000_fix_message_trigger_schema.sql; this legacy script is retired.'::text
  as migration_required;
