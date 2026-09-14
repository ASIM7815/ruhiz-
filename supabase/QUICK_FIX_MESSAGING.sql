-- DEPRECATED: do not run this legacy policy-only fix.
--
-- The reported error is from a messages trigger/function mismatch, not from
-- Realtime settings or a reason to simplify away conversation membership.
-- Apply the complete, idempotent hotfix instead:
--   supabase/migrations/20260914000000_fix_message_trigger_schema.sql
--
-- Read-only inspection:
--   supabase/diagnose_messaging_readonly.sql
select
  'Use supabase/migrations/20260914000000_fix_message_trigger_schema.sql; this legacy script is retired.'::text
  as migration_required;
