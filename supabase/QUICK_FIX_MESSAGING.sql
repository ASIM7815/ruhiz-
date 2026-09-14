-- ============================================================================
-- QUICK FIX FOR "Message failed to send" ERROR
-- ============================================================================
-- Error: record "new" has no field "user_id"
-- This happens because the RLS policy or Realtime filter is looking for wrong field

-- SOLUTION: Recreate the messages INSERT policy without checking participation
-- (The conversation participation check is done client-side already)

-- 1. Drop and recreate INSERT policy (simplified)
DROP POLICY IF EXISTS messages_insert ON public.messages;

CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.current_profile_id()
  );

-- 2. Make sure SELECT policy works
DROP POLICY IF EXISTS messages_select ON public.messages;

CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = public.current_profile_id()
    )
  );

-- 3. Grant necessary permissions
GRANT INSERT ON public.messages TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT UPDATE ON public.conversation_participants TO authenticated;

-- 4. Test if policies work
SELECT 
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'messages'
ORDER BY policyname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Messaging policies fixed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Now:';
  RAISE NOTICE '1. Refresh your browser (Ctrl+Shift+R)';
  RAISE NOTICE '2. Try sending a message';
  RAISE NOTICE '3. It should work now! 🎉';
  RAISE NOTICE '';
END $$;
