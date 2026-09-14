-- ============================================================================
-- DEEP INSPECTION OF MESSAGES TABLE SCHEMA AND RELATED OBJECTS
-- ============================================================================
-- Run this in Supabase SQL Editor to see the ACTUAL current state

-- 1. Show actual messages table columns
SELECT 
    '=== MESSAGES TABLE COLUMNS ===' as section,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- 2. Show all constraints on messages table
SELECT 
    '=== MESSAGES TABLE CONSTRAINTS ===' as section,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'messages';

-- 3. Show foreign keys
SELECT
    '=== MESSAGES FOREIGN KEYS ===' as section,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema='public'
  AND tc.table_name='messages';

-- 4. Show ALL triggers on messages table
SELECT 
    '=== MESSAGES TABLE TRIGGERS ===' as section,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'messages'
ORDER BY trigger_name;

-- 5. Show trigger function definitions (these might reference NEW.user_id)
SELECT 
    '=== TRIGGER FUNCTIONS USED BY MESSAGES ===' as section,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    SELECT DISTINCT regexp_replace(action_statement, '.*EXECUTE (FUNCTION|PROCEDURE) ([^(]+).*', '\2')
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'messages'
  );

-- 6. Show ALL RLS policies on messages table
SELECT 
    '=== MESSAGES RLS POLICIES ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual::text as using_expression,
    with_check::text as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'messages'
ORDER BY policyname;

-- 7. Check if Realtime is enabled
SELECT 
    '=== REALTIME PUBLICATION ===' as section,
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversation_participants', 'conversations')
ORDER BY tablename;

-- 8. Show conversation_participants schema (for reference)
SELECT 
    '=== CONVERSATION_PARTICIPANTS COLUMNS ===' as section,
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'conversation_participants'
ORDER BY ordinal_position;

-- 9. Show profiles table relevant columns
SELECT 
    '=== PROFILES TABLE COLUMNS ===' as section,
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('id', 'user_id', 'username')
ORDER BY ordinal_position;

-- 10. Test current_profile_id() function
SELECT 
    '=== TEST CURRENT_PROFILE_ID ===' as section,
    public.current_profile_id() as my_profile_id,
    auth.uid() as my_auth_uid;

-- 11. Show sample data structure (if any messages exist)
SELECT 
    '=== SAMPLE MESSAGE STRUCTURE ===' as section,
    column_name,
    pg_typeof(column_name::text) as type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
LIMIT 1;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ INSPECTION COMPLETE';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Review the output above to find:';
    RAISE NOTICE '1. Actual column names in messages table';
    RAISE NOTICE '2. Triggers that might reference NEW.user_id';
    RAISE NOTICE '3. RLS policies that might be wrong';
    RAISE NOTICE '4. Foreign key relationships';
    RAISE NOTICE '';
END $$;
