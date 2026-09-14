-- ============================================================================
-- COMPREHENSIVE POST INSERT DIAGNOSTIC
-- ============================================================================
-- This diagnoses the EXACT flow when creating a text moment/post

-- STEP 1: Check current authentication
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 1: AUTHENTICATION CHECK';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    'Current Auth User' as check_type,
    auth.uid() as auth_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN '❌ NOT AUTHENTICATED'
        ELSE '✅ AUTHENTICATED'
    END as status;

-- STEP 2: Check if profile exists for current user
SELECT 
    'Profile Lookup' as check_type,
    p.id as profile_id,
    p.username,
    p.user_id,
    CASE 
        WHEN p.id IS NULL THEN '❌ NO PROFILE FOUND'
        WHEN p.user_id IS NULL THEN '❌ PROFILE HAS NO user_id (DEMO ACCOUNT)'
        WHEN p.user_id != auth.uid() THEN '❌ PROFILE user_id MISMATCH'
        ELSE '✅ VALID PROFILE'
    END as status
FROM public.profiles p
WHERE p.user_id = auth.uid()
LIMIT 1;

-- STEP 3: Check current_profile_id() function
SELECT 
    'current_profile_id() Function' as check_type,
    public.current_profile_id() as profile_id,
    CASE 
        WHEN public.current_profile_id() IS NULL THEN '❌ FUNCTION RETURNS NULL'
        ELSE '✅ FUNCTION WORKS'
    END as status;

-- STEP 4: Check posts table structure
SELECT 
    'Posts Table Columns' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'posts'
ORDER BY ordinal_position;

-- STEP 5: Check RLS is enabled
SELECT 
    'Posts Table RLS Status' as check_type,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'posts';

-- STEP 6: Check INSERT policy
SELECT 
    'Posts INSERT Policy' as check_type,
    policyname,
    with_check::text as policy_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'posts' 
  AND cmd = 'INSERT';

-- STEP 7: Test INSERT permission (dry run - won't actually insert)
DO $$
DECLARE
    v_profile_id uuid;
    v_can_insert boolean := false;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 7: INSERT PERMISSION TEST';
    RAISE NOTICE '========================================';
    
    -- Get current profile ID
    v_profile_id := public.current_profile_id();
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE '❌ Cannot test: current_profile_id() is NULL';
        RETURN;
    END IF;
    
    -- Check if INSERT would be allowed
    BEGIN
        PERFORM 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'posts' 
          AND cmd = 'INSERT';
        
        IF FOUND THEN
            v_can_insert := true;
            RAISE NOTICE '✅ INSERT policy exists';
            RAISE NOTICE 'Profile ID that would be used: %', v_profile_id;
        ELSE
            RAISE NOTICE '❌ No INSERT policy found';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error checking policy: %', SQLERRM;
    END;
END $$;

-- STEP 8: Check grants
SELECT 
    'Posts Table Grants' as check_type,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND grantee IN ('authenticated', 'anon', 'public');

-- STEP 9: Simulate the exact INSERT the frontend sends
DO $$
DECLARE
    v_profile_id uuid;
    v_test_post_id uuid;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STEP 9: SIMULATE FRONTEND INSERT';
    RAISE NOTICE '========================================';
    
    v_profile_id := public.current_profile_id();
    
    IF v_profile_id IS NULL THEN
        RAISE NOTICE '❌ CANNOT INSERT: current_profile_id() returns NULL';
        RAISE NOTICE 'This means either:';
        RAISE NOTICE '  1. You are not authenticated';
        RAISE NOTICE '  2. Your auth user has no profile in profiles table';
        RAISE NOTICE '  3. The current_profile_id() function is broken';
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ Using profile_id: %', v_profile_id;
    
    BEGIN
        -- Attempt the exact INSERT that frontend sends
        INSERT INTO public.posts (
            user_id,
            type,
            content,
            image_url,
            video_url,
            topics
        ) VALUES (
            v_profile_id,
            'moment',
            'Test text moment with emoji 💚 and special chars: @#$%',
            NULL,
            NULL,
            ARRAY['Mental Health', 'Life']
        ) RETURNING id INTO v_test_post_id;
        
        RAISE NOTICE '✅✅✅ INSERT SUCCEEDED!';
        RAISE NOTICE 'New post ID: %', v_test_post_id;
        RAISE NOTICE '';
        RAISE NOTICE 'Verifying the inserted post...';
        
        -- Verify it was inserted
        PERFORM 1 FROM public.posts WHERE id = v_test_post_id;
        IF FOUND THEN
            RAISE NOTICE '✅ Post exists in database';
        ELSE
            RAISE NOTICE '❌ Post disappeared after insert (RLS issue?)';
        END IF;
        
        -- Clean up test post
        DELETE FROM public.posts WHERE id = v_test_post_id;
        RAISE NOTICE '🧹 Test post cleaned up';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌❌❌ INSERT FAILED!';
        RAISE NOTICE 'Error Code: %', SQLSTATE;
        RAISE NOTICE 'Error Message: %', SQLERRM;
        RAISE NOTICE 'Error Detail: %', DETAIL;
        RAISE NOTICE '';
        RAISE NOTICE 'Common causes:';
        RAISE NOTICE '  1. RLS policy rejects: user_id != current_profile_id()';
        RAISE NOTICE '  2. Foreign key violation: profile_id does not exist';
        RAISE NOTICE '  3. Check constraint: invalid type or status value';
        RAISE NOTICE '  4. Permission denied: authenticated role lacks INSERT grant';
    END;
END $$;

-- STEP 10: Show recent posts to verify feed works
SELECT 
    'Recent Posts (Last 5)' as check_type,
    id,
    type,
    LEFT(content, 50) as content_preview,
    topics,
    created_at
FROM public.posts
ORDER BY created_at DESC
LIMIT 5;

-- Final Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ DIAGNOSTIC COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Review the results above to find the issue.';
    RAISE NOTICE 'Key things to check:';
    RAISE NOTICE '  1. Are you authenticated? (auth.uid() should return a UUID)';
    RAISE NOTICE '  2. Does your profile exist? (profiles.user_id = auth.uid())';
    RAISE NOTICE '  3. Does current_profile_id() work? (should return profiles.id)';
    RAISE NOTICE '  4. Did the test INSERT succeed?';
    RAISE NOTICE '';
    RAISE NOTICE 'If test INSERT succeeded, the issue is in the FRONTEND.';
    RAISE NOTICE 'If test INSERT failed, the issue is in DATABASE/RLS.';
    RAISE NOTICE '';
END $$;
