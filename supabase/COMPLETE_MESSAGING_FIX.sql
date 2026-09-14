-- ============================================================================
-- COMPLETE MESSAGING FIX - Inspect, Fix, and Verify
-- ============================================================================
-- This script will:
-- 1. Show current state
-- 2. Fix all issues
-- 3. Verify everything works

-- ============================================================================
-- PART 1: INSPECTION
-- ============================================================================

-- Show actual messages table structure
\echo '=== MESSAGES TABLE COLUMNS ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'messages'
ORDER BY ordinal_position;

-- Show current RLS policies
\echo ''
\echo '=== CURRENT RLS POLICIES ON MESSAGES ==='
SELECT policyname, cmd, qual::text as using_clause, with_check::text as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'messages';

-- Show triggers
\echo ''
\echo '=== TRIGGERS ON MESSAGES ==='
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'messages';

-- ============================================================================
-- PART 2: FIX - Remove ALL old policies and create new ones
-- ============================================================================

\echo ''
\echo '=== FIXING RLS POLICIES ==='

-- Disable RLS temporarily
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'messages'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create helper function if it doesn't exist
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Create helper function for participant check
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public 
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation AND cp.user_id = p_user
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

-- Create NEW policies with simple, working logic
CREATE POLICY "messages_insert_v2" ON public.messages
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        sender_id = public.current_profile_id()
    );

CREATE POLICY "messages_select_v2" ON public.messages
    FOR SELECT 
    TO authenticated
    USING (
        public.is_conversation_participant(conversation_id, public.current_profile_id())
    );

CREATE POLICY "messages_delete_v2" ON public.messages
    FOR DELETE 
    TO authenticated
    USING (
        sender_id = public.current_profile_id()
    );

-- Grant table permissions
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT, UPDATE ON public.conversation_participants TO authenticated;

-- ============================================================================
-- PART 3: VERIFICATION
-- ============================================================================

\echo ''
\echo '=== NEW RLS POLICIES ==='
SELECT 
    policyname, 
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 100) 
        ELSE 'N/A' 
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN substring(with_check::text, 1, 100)
        ELSE 'N/A'
    END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'messages'
ORDER BY policyname;

-- Test the functions
\echo ''
\echo '=== TESTING HELPER FUNCTIONS ==='
SELECT 
    'Current auth UID' as test,
    auth.uid() as result;

SELECT 
    'Current profile ID' as test,
    public.current_profile_id() as result;

-- Check if messages table has the right columns
\echo ''
\echo '=== VERIFY MESSAGES COLUMNS ==='
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'messages'
              AND column_name = 'sender_id'
        ) THEN '✅ sender_id column EXISTS'
        ELSE '❌ sender_id column MISSING'
    END as sender_id_check,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'messages'
              AND column_name = 'conversation_id'
        ) THEN '✅ conversation_id column EXISTS'
        ELSE '❌ conversation_id column MISSING'
    END as conversation_id_check,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'messages'
              AND column_name = 'content'
        ) THEN '✅ content column EXISTS'
        ELSE '❌ content column MISSING'
    END as content_check;

-- ============================================================================
-- PART 4: ENABLE REALTIME
-- ============================================================================

\echo ''
\echo '=== ENABLING REALTIME ==='

-- Add messages to realtime publication if not already there
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        RAISE NOTICE '✅ Added messages to realtime publication';
    ELSE
        RAISE NOTICE '✅ messages already in realtime publication';
    END IF;
END $$;

-- Check realtime status
\echo ''
\echo '=== REALTIME STATUS ==='
SELECT 
    tablename,
    CASE 
        WHEN tablename IN (
            SELECT tablename FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime'
        ) THEN '✅ Enabled'
        ELSE '❌ Not enabled'
    END as realtime_status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('messages', 'conversation_participants', 'conversations')
ORDER BY tablename;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE '✅ MESSAGING FIX COMPLETE!';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'What was fixed:';
    RAISE NOTICE '  1. Removed all old RLS policies';
    RAISE NOTICE '  2. Created new working policies';
    RAISE NOTICE '  3. Granted necessary permissions';
    RAISE NOTICE '  4. Enabled Realtime';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Hard refresh browser (Ctrl+Shift+R)';
    RAISE NOTICE '  2. Clear browser cache if needed';
    RAISE NOTICE '  3. Login again';
    RAISE NOTICE '  4. Go to Messages';
    RAISE NOTICE '  5. Send a test message';
    RAISE NOTICE '  6. Should work now! 🎉';
    RAISE NOTICE '';
    RAISE NOTICE 'If still fails, check browser console for errors';
    RAISE NOTICE '';
    RAISE NOTICE '=======================================================';
END $$;
