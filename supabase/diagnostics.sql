-- Ruhiz Database Diagnostics
-- Run this in Supabase SQL Editor to check your database setup

-- ============================================
-- 1. CHECK IF ALL TABLES EXIST
-- ============================================
SELECT 
  'Table Check' as check_type,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'posts', 'problems', 'post_problems', 
    'comments', 'post_supports', 'post_saves', 'been_there',
    'supporters', 'activities', 'notifications',
    'conversations', 'conversation_participants', 'messages'
  )
ORDER BY table_name;

-- ============================================
-- 2. CHECK ROW COUNTS
-- ============================================
SELECT 'Row Counts' as check_type;

SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'posts' as table_name, COUNT(*) as row_count FROM posts
UNION ALL
SELECT 'problems' as table_name, COUNT(*) as row_count FROM problems
UNION ALL
SELECT 'post_problems' as table_name, COUNT(*) as row_count FROM post_problems
UNION ALL
SELECT 'comments' as table_name, COUNT(*) as row_count FROM comments
UNION ALL
SELECT 'supporters' as table_name, COUNT(*) as row_count FROM supporters
UNION ALL
SELECT 'activities' as table_name, COUNT(*) as row_count FROM activities
UNION ALL
SELECT 'notifications' as table_name, COUNT(*) as row_count FROM notifications
UNION ALL
SELECT 'conversations' as table_name, COUNT(*) as row_count FROM conversations
UNION ALL
SELECT 'messages' as table_name, COUNT(*) as row_count FROM messages;

-- ============================================
-- 3. CHECK YOUR PROFILE
-- ============================================
SELECT 
  'Your Profile' as check_type,
  p.*
FROM profiles p
WHERE p.user_id = auth.uid();

-- ============================================
-- 4. CHECK RLS POLICIES
-- ============================================
SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE WHEN qual IS NOT NULL THEN '✅ HAS USING' ELSE '❌ NO USING' END as using_clause,
  CASE WHEN with_check IS NOT NULL THEN '✅ HAS CHECK' ELSE '❌ NO CHECK' END as check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'posts', 'comments')
ORDER BY tablename, policyname;

-- ============================================
-- 5. CHECK SAMPLE DATA (PERSONAS)
-- ============================================
SELECT 
  'Sample Personas' as check_type,
  id,
  username,
  display_name,
  is_persona,
  user_id
FROM profiles
WHERE is_persona = true
ORDER BY username
LIMIT 10;

-- ============================================
-- 6. CHECK LIVE POSTS
-- ============================================
SELECT 
  'Live Posts' as check_type,
  p.id,
  p.type,
  LEFT(p.content, 50) as content_preview,
  p.support_count,
  p.comment_count,
  p.status,
  pr.username as author
FROM posts p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.status = 'live'
ORDER BY p.created_at DESC
LIMIT 5;

-- ============================================
-- 7. TEST RLS ACCESS
-- ============================================
-- This should return posts (proves RLS allows reading)
SELECT 
  'RLS Test - Can Read Posts?' as check_type,
  COUNT(*) as accessible_posts
FROM posts
WHERE status = 'live';

-- ============================================
-- 8. CHECK PROBLEMS/TOPICS
-- ============================================
SELECT 
  'Problems/Topics' as check_type,
  id,
  label,
  emoji,
  sort
FROM problems
ORDER BY sort
LIMIT 10;

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
  'Summary' as check_type,
  'If you see data in all sections above, your database is set up correctly!' as message;
