-- ============================================================================
-- FIX: Update video posts with real YouTube URLs
-- ============================================================================

-- Update the 4 video posts with working YouTube URLs
UPDATE public.posts
SET video_url = 'https://www.youtube.com/watch?v=9bZkp7q19f0'
WHERE id = 'b0000000-0000-4000-8000-000000000016'
  AND type = 'video';

UPDATE public.posts
SET video_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
WHERE id = 'b0000000-0000-4000-8000-000000000003'
  AND type = 'video';

UPDATE public.posts
SET video_url = 'https://www.youtube.com/watch?v=y6120QOlsfU'
WHERE id = 'b0000000-0000-4000-8000-000000000013'
  AND type = 'video';

UPDATE public.posts
SET video_url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
WHERE id = 'b0000000-0000-4000-8000-000000000008'
  AND type = 'video';

-- Verify the updates
SELECT 
  '✅ Video Posts Updated:' as status,
  id,
  LEFT(content, 50) as content_preview,
  video_url
FROM public.posts
WHERE type = 'video'
  AND id IN (
    'b0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000008',
    'b0000000-0000-4000-8000-000000000013',
    'b0000000-0000-4000-8000-000000000016'
  )
ORDER BY created_at DESC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎬 Video URLs updated!';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 4 video posts now have real YouTube URLs';
  RAISE NOTICE '✅ Videos will play in embedded YouTube player';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Refresh your browser to see the videos working!';
  RAISE NOTICE '';
END $$;
