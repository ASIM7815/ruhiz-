-- Check if challenge_posts tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('challenge_posts', 'challenge_post_media', 'challenge_post_likes', 'challenge_post_comments')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'challenge_posts',
    'challenge_post_media', 
    'challenge_post_likes',
    'challenge_post_comments'
  )
ORDER BY table_name;

-- If empty result, the migration hasn't been run yet
-- Run: supabase/migrations/20260922000000_challenge_posts_architecture.sql
