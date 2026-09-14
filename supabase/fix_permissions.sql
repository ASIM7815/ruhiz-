-- ============================================================================
-- FIX: Grant required permissions to authenticated users
-- ============================================================================
-- Error: "permission denied for table profiles" (code 42501)
-- Solution: Grant INSERT, SELECT, UPDATE, DELETE on all tables to authenticated role

-- 1. Add missing joined_at column (if not already done)
ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

-- 2. Grant ALL required permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 3. Specifically ensure profiles table has correct permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_supports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_saves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.been_there TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supporters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_problem_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_problems TO authenticated;

-- 4. Grant USAGE on sequences (for auto-increment IDs if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Verify the permissions were granted
SELECT 
  grantee, 
  table_schema, 
  table_name, 
  privilege_type
FROM information_schema.table_privileges 
WHERE grantee = 'authenticated' 
  AND table_schema = 'public'
  AND table_name IN ('profiles', 'posts', 'comments', 'conversation_participants')
ORDER BY table_name, privilege_type;

-- Expected output: You should see SELECT, INSERT, UPDATE, DELETE for each table

-- ============================================================================
-- VERIFY RLS POLICIES ARE CORRECT
-- ============================================================================

-- Check profiles RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Expected: 
-- - profiles_select: SELECT using (true)
-- - profiles_insert: INSERT with check (auth.uid() = user_id)
-- - profiles_update: UPDATE using (auth.uid() = user_id)

-- ============================================================================
-- VERIFY CURRENT USER CAN INSERT
-- ============================================================================

-- This should return TRUE if you're logged in and have permissions
SELECT 
  'Current User Check' as test,
  auth.uid() as my_user_id,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ Authenticated'
    ELSE '❌ Not authenticated'
  END as auth_status;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Permissions granted to authenticated role';
  RAISE NOTICE '✅ All tables: SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '✅ joined_at column added to conversation_participants';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '   1. Refresh your browser (Ctrl+Shift+R)';
  RAISE NOTICE '   2. Login again';
  RAISE NOTICE '   3. Check console - should see: [Ruhiz] Production data loaded successfully!';
  RAISE NOTICE '   4. Your real profile should appear (not Iron Man demo)';
END $$;
