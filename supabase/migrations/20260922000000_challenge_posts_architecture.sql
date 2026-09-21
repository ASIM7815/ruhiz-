-- ============================================================================
-- CHALLENGE POSTS ARCHITECTURE
-- ============================================================================
-- Complete redesign: Challenge → Daily Entries → Media
-- 
-- Architecture:
--   1. challenges = parent container (title, description, rules, duration)
--   2. challenge_posts = daily entries inside a challenge (day number, caption)
--   3. challenge_post_media = photos/videos attached to each entry
--   4. Each entry can have multiple media files
--   5. No fake data, only real user-generated content
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP OLD POSTS SYSTEM (if exists from previous migration)
-- ============================================================================

DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.post_media CASCADE;
DROP TABLE IF EXISTS public.post_likes CASCADE;
DROP TABLE IF EXISTS public.post_comments CASCADE;

-- ============================================================================
-- 2. CHALLENGE_POSTS - Daily entries inside a challenge
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.challenge_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_number      int NOT NULL CHECK (day_number >= 1 AND day_number <= 365),
  caption         text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 2000),
  like_count      int NOT NULL DEFAULT 0,
  comment_count   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  
  -- A user can only post once per day per challenge
  UNIQUE (challenge_id, user_id, day_number)
);

CREATE INDEX idx_challenge_posts_challenge ON public.challenge_posts (challenge_id, day_number);
CREATE INDEX idx_challenge_posts_user ON public.challenge_posts (user_id, created_at DESC);
CREATE INDEX idx_challenge_posts_created ON public.challenge_posts (created_at DESC);

-- ============================================================================
-- 3. CHALLENGE_POST_MEDIA - Photos/videos attached to each post
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.challenge_post_media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         uuid NOT NULL REFERENCES public.challenge_posts(id) ON DELETE CASCADE,
  media_type      text NOT NULL CHECK (media_type IN ('image', 'video')),
  url             text NOT NULL,
  thumbnail_url   text,
  width           int,
  height          int,
  duration_ms     int,
  file_size       bigint,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_media_post ON public.challenge_post_media (post_id, sort_order);

-- ============================================================================
-- 4. CHALLENGE_POST_LIKES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.challenge_post_likes (
  post_id    uuid NOT NULL REFERENCES public.challenge_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX idx_post_likes_user ON public.challenge_post_likes (user_id, created_at DESC);

-- ============================================================================
-- 5. CHALLENGE_POST_COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.challenge_post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.challenge_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_comments_post ON public.challenge_post_comments (post_id, created_at);
CREATE INDEX idx_post_comments_user ON public.challenge_post_comments (user_id, created_at DESC);

-- ============================================================================
-- 6. TRIGGERS FOR COUNTERS
-- ============================================================================

-- Post like counter
CREATE OR REPLACE FUNCTION fn_post_like_counter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenge_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenge_posts 
    SET like_count = GREATEST(0, like_count - 1) 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_like_counter ON public.challenge_post_likes;
CREATE TRIGGER trg_post_like_counter 
  AFTER INSERT OR DELETE ON public.challenge_post_likes
  FOR EACH ROW EXECUTE FUNCTION fn_post_like_counter();

-- Post comment counter
CREATE OR REPLACE FUNCTION fn_post_comment_counter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.challenge_posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.challenge_posts 
    SET comment_count = GREATEST(0, comment_count - 1) 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_comment_counter ON public.challenge_post_comments;
CREATE TRIGGER trg_post_comment_counter 
  AFTER INSERT OR DELETE ON public.challenge_post_comments
  FOR EACH ROW EXECUTE FUNCTION fn_post_comment_counter();

-- Updated_at trigger for posts
DROP TRIGGER IF EXISTS trg_challenge_posts_updated_at ON public.challenge_posts;
CREATE TRIGGER trg_challenge_posts_updated_at 
  BEFORE UPDATE ON public.challenge_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

ALTER TABLE public.challenge_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_post_comments ENABLE ROW LEVEL SECURITY;

-- Challenge Posts: Everyone can read, only author can insert/update/delete
DROP POLICY IF EXISTS challenge_posts_read ON public.challenge_posts;
CREATE POLICY challenge_posts_read ON public.challenge_posts 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS challenge_posts_insert ON public.challenge_posts;
CREATE POLICY challenge_posts_insert ON public.challenge_posts 
  FOR INSERT 
  WITH CHECK (user_id = public.duel_current_profile_id());

DROP POLICY IF EXISTS challenge_posts_update ON public.challenge_posts;
CREATE POLICY challenge_posts_update ON public.challenge_posts 
  FOR UPDATE 
  USING (user_id = public.duel_current_profile_id());

DROP POLICY IF EXISTS challenge_posts_delete ON public.challenge_posts;
CREATE POLICY challenge_posts_delete ON public.challenge_posts 
  FOR DELETE 
  USING (user_id = public.duel_current_profile_id());

-- Post Media: Everyone can read, only post author can insert/delete
DROP POLICY IF EXISTS post_media_read ON public.challenge_post_media;
CREATE POLICY post_media_read ON public.challenge_post_media 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS post_media_insert ON public.challenge_post_media;
CREATE POLICY post_media_insert ON public.challenge_post_media 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.challenge_posts 
      WHERE id = post_id AND user_id = public.duel_current_profile_id()
    )
  );

DROP POLICY IF EXISTS post_media_delete ON public.challenge_post_media;
CREATE POLICY post_media_delete ON public.challenge_post_media 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.challenge_posts 
      WHERE id = post_id AND user_id = public.duel_current_profile_id()
    )
  );

-- Post Likes: Everyone can read, authenticated users can like
DROP POLICY IF EXISTS post_likes_read ON public.challenge_post_likes;
CREATE POLICY post_likes_read ON public.challenge_post_likes 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS post_likes_insert ON public.challenge_post_likes;
CREATE POLICY post_likes_insert ON public.challenge_post_likes 
  FOR INSERT 
  WITH CHECK (user_id = public.duel_current_profile_id());

DROP POLICY IF EXISTS post_likes_delete ON public.challenge_post_likes;
CREATE POLICY post_likes_delete ON public.challenge_post_likes 
  FOR DELETE 
  USING (user_id = public.duel_current_profile_id());

-- Post Comments: Everyone can read, authenticated users can comment
DROP POLICY IF EXISTS post_comments_read ON public.challenge_post_comments;
CREATE POLICY post_comments_read ON public.challenge_post_comments 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS post_comments_insert ON public.challenge_post_comments;
CREATE POLICY post_comments_insert ON public.challenge_post_comments 
  FOR INSERT 
  WITH CHECK (user_id = public.duel_current_profile_id());

DROP POLICY IF EXISTS post_comments_delete ON public.challenge_post_comments;
CREATE POLICY post_comments_delete ON public.challenge_post_comments 
  FOR DELETE 
  USING (user_id = public.duel_current_profile_id());

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Get all posts for a challenge (timeline view)
CREATE OR REPLACE FUNCTION get_challenge_timeline(p_challenge_id uuid)
RETURNS TABLE (
  post_id uuid,
  day_number int,
  caption text,
  like_count int,
  comment_count int,
  created_at timestamptz,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  media jsonb
) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.day_number,
    cp.caption,
    cp.like_count,
    cp.comment_count,
    cp.created_at,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'type', m.media_type,
            'url', m.url,
            'thumbnailUrl', m.thumbnail_url,
            'width', m.width,
            'height', m.height,
            'durationMs', m.duration_ms,
            'order', m.sort_order
          ) ORDER BY m.sort_order
        )
        FROM public.challenge_post_media m
        WHERE m.post_id = cp.id
      ),
      '[]'::jsonb
    ) as media
  FROM public.challenge_posts cp
  JOIN public.profiles p ON cp.user_id = p.id
  WHERE cp.challenge_id = p_challenge_id
  ORDER BY cp.day_number ASC, cp.created_at ASC;
END;
$$;

-- Get posts for Explore (recent posts with media)
CREATE OR REPLACE FUNCTION get_explore_posts(p_limit int DEFAULT 50)
RETURNS TABLE (
  post_id uuid,
  challenge_id uuid,
  challenge_title text,
  day_number int,
  caption text,
  like_count int,
  comment_count int,
  created_at timestamptz,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  media jsonb
) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.challenge_id,
    c.title,
    cp.day_number,
    cp.caption,
    cp.like_count,
    cp.comment_count,
    cp.created_at,
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'type', m.media_type,
            'url', m.url,
            'thumbnailUrl', m.thumbnail_url,
            'width', m.width,
            'height', m.height,
            'durationMs', m.duration_ms,
            'order', m.sort_order
          ) ORDER BY m.sort_order
        )
        FROM public.challenge_post_media m
        WHERE m.post_id = cp.id
      ),
      '[]'::jsonb
    ) as media
  FROM public.challenge_posts cp
  JOIN public.profiles p ON cp.user_id = p.id
  JOIN public.challenges c ON cp.challenge_id = c.id
  WHERE EXISTS (
    SELECT 1 FROM public.challenge_post_media m 
    WHERE m.post_id = cp.id
  )
  ORDER BY cp.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (optional - run separately to verify)
-- ============================================================================

-- Check tables were created:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name LIKE 'challenge_post%';

-- Check functions were created:
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
-- AND routine_name LIKE '%post%' OR routine_name LIKE 'get_%timeline';

-- ============================================================================
-- SUCCESS: Challenge posts architecture created
-- 
-- Tables:
--   - challenge_posts (daily entries)
--   - challenge_post_media (photos/videos)
--   - challenge_post_likes
--   - challenge_post_comments
--
-- Functions:
--   - get_challenge_timeline(challenge_id)
--   - get_explore_posts(limit)
--
-- Architecture: Challenge → Daily Posts → Media
-- ============================================================================
