-- ============================================================================
-- QUICK SCHEMA CHECK (No auth required - run as service role)
-- ============================================================================

-- 1. Posts table structure
SELECT 
    '1. POSTS TABLE STRUCTURE' as section,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'posts'
ORDER BY ordinal_position;

-- 2. RLS status
SELECT 
    '2. RLS STATUS' as section,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'posts';

-- 3. INSERT policy
SELECT 
    '3. INSERT POLICY' as section,
    policyname,
    roles::text,
    with_check::text as policy_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'posts' 
  AND cmd = 'INSERT';

-- 4. Grants
SELECT 
    '4. TABLE GRANTS' as section,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'posts'
  AND grantee IN ('authenticated', 'anon');

-- 5. Check current_profile_id function exists
SELECT 
    '5. CURRENT_PROFILE_ID FUNCTION' as section,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'current_profile_id';

-- 6. Recent posts count
SELECT 
    '6. RECENT POSTS' as section,
    COUNT(*) as total_posts,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as posts_last_24h,
    COUNT(CASE WHEN type = 'moment' THEN 1 END) as moment_posts,
    COUNT(CASE WHEN type = 'photo' THEN 1 END) as photo_posts,
    COUNT(CASE WHEN type = 'video' THEN 1 END) as video_posts
FROM public.posts;

-- 7. Sample of recent posts
SELECT 
    '7. SAMPLE RECENT POSTS' as section,
    id,
    type,
    LEFT(content, 30) as content_preview,
    topics,
    created_at
FROM public.posts
ORDER BY created_at DESC
LIMIT 3;
