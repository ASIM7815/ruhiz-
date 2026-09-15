-- ============================================================================
-- DELETE ALL VIDEO POSTS FROM PLATFORM
-- ============================================================================
-- This removes all video posts and their related data safely

BEGIN;

-- Show what will be deleted
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VIDEO POSTS TO BE DELETED';
    RAISE NOTICE '========================================';
END $$;

SELECT 
    'Video posts found' as info,
    COUNT(*) as total_videos,
    COUNT(DISTINCT user_id) as affected_users
FROM public.posts
WHERE type = 'video';

-- Show video posts details
SELECT 
    'Video post details' as info,
    id,
    LEFT(content, 50) as content_preview,
    video_url,
    created_at
FROM public.posts
WHERE type = 'video'
ORDER BY created_at DESC
LIMIT 10;

-- Delete video posts (CASCADE will handle related data automatically)
-- Related tables that will cascade:
--   - post_problems (classification data)
--   - post_supports (likes)
--   - comments
--   - post_saves (bookmarks)
--   - been_there
--   - activities
--   - notifications (references to deleted posts)

DELETE FROM public.posts
WHERE type = 'video';

-- Verify deletion
SELECT 
    'Verification: Remaining video posts' as info,
    COUNT(*) as remaining_videos
FROM public.posts
WHERE type = 'video';

-- Show remaining post counts by type
SELECT 
    'Remaining posts by type' as info,
    type,
    COUNT(*) as count
FROM public.posts
GROUP BY type
ORDER BY count DESC;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ALL VIDEO POSTS DELETED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Deleted:';
    RAISE NOTICE '  - All video posts';
    RAISE NOTICE '  - Related classifications';
    RAISE NOTICE '  - Related supports/comments/saves';
    RAISE NOTICE '  - Related activities';
    RAISE NOTICE '';
    RAISE NOTICE 'Video uploads will now work cleanly!';
    RAISE NOTICE '';
END $$;

COMMIT;
