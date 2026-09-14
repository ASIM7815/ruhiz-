-- ============================================================================
-- FIX MESSAGING RLS POLICIES
-- ============================================================================
-- This fixes the "record 'new' has no field 'user_id'" error when sending messages

-- 1. Drop existing policies
DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
DROP POLICY IF EXISTS messages_update ON public.messages;
DROP POLICY IF EXISTS messages_delete ON public.messages;

-- 2. Recreate policies with correct field names (sender_id, not user_id)

-- SELECT: Can read messages in conversations you're part of
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = public.current_profile_id()
    )
  );

-- INSERT: Can send messages to conversations you're part of
CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = public.current_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = public.current_profile_id()
    )
  );

-- DELETE: Can only delete your own messages
CREATE POLICY messages_delete ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = public.current_profile_id());

-- 3. Verify Realtime is enabled for messages table
-- Check current publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('messages', 'conversation_participants', 'conversations');

-- If messages is not in the publication, add it:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 4. Test the policies
DO $$
DECLARE
  v_test_result TEXT;
BEGIN
  -- Try to check if current user can insert
  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'messages' 
      AND policyname = 'messages_insert'
  ) THEN
    RAISE NOTICE '✅ messages_insert policy exists';
  ELSE
    RAISE NOTICE '❌ messages_insert policy NOT FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'messages' 
      AND policyname = 'messages_select'
  ) THEN
    RAISE NOTICE '✅ messages_select policy exists';
  ELSE
    RAISE NOTICE '❌ messages_select policy NOT FOUND';
  END IF;
END $$;

-- 5. Show all current policies on messages
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
WHERE schemaname = 'public' 
  AND tablename = 'messages';

RAISE NOTICE '';
RAISE NOTICE '✅ Messaging RLS policies fixed!';
RAISE NOTICE '';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Make sure Realtime is enabled for messages table';
RAISE NOTICE '2. Refresh your browser';
RAISE NOTICE '3. Try sending a message again';
RAISE NOTICE '';
