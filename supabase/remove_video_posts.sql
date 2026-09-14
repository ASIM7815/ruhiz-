-- ============================================================================
-- REMOVE ALL VIDEO POSTS FROM DEMO ACCOUNTS
-- ============================================================================
-- This will delete all video posts to avoid "Video unavailable" issues
-- Photo, moment, and question posts will remain

-- 1. Show which video posts will be deleted
SELECT 
  '🎬 Video Posts to Delete:' as status,
  p.id,
  pr.username,
  LEFT(p.content, 60) as content_preview,
  p.created_at
FROM posts p
JOIN profiles pr ON pr.id = p.user_id
WHERE p.type = 'video'
ORDER BY p.created_at DESC;

-- 2. Delete all video posts
DELETE FROM public.posts
WHERE type = 'video';

-- 3. Verify deletion
SELECT 
  '✅ Remaining Posts:' as status,
  type,
  COUNT(*) as count
FROM posts
GROUP BY type
ORDER BY type;

-- Success message
DO $$
DECLARE
  v_deleted INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_deleted FROM posts WHERE type = 'video';
  
  IF v_deleted = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ All video posts removed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Remaining post types:';
    RAISE NOTICE '   - Photo posts';
    RAISE NOTICE '   - Moment posts';
    RAISE NOTICE '   - Question posts';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Refresh your browser - no more "Video unavailable" messages!';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '⚠️  Still found % video posts', v_deleted;
  END IF;
END $$;
