-- ============================================================================
-- FIX: CHECK-IN ENGINE (single source of truth)
-- ============================================================================
-- Background
-- ----------
-- 20260920000000_duel_platform.sql installs the check-in engine:
--   * trigger trg_duel_apply_checkin (BEFORE INSERT on challenge_checkins)
--     owns streaks, completed_days, completion, notifications and activity.
--   * duel_checkin() is a thin RPC that just inserts the row (or updates it on
--     a (challenge, user, day_number) conflict).
--
-- 20260922100000_sync_checkins_with_posts.sql replaced duel_checkin() with a
-- copy of that engine *inside* the function and also wrote challenge_posts
-- rows. That version breaks in two ways:
--   1. It updates challenge_participants.last_checkin_date BEFORE inserting the
--      check-in, so the BEFORE INSERT trigger immediately raises
--      'already checked in today' — every check-in fails.
--   2. Had it succeeded, the maths would run twice (function + trigger),
--      double-counting completed_days and streaks.
--
-- This migration restores the thin RPC, teaches it about edits, and stops the
-- duplicate writes to the legacy challenge_posts tables (the app reads posts
-- straight from challenge_checkins — see lib/duel/*).
--
-- Edit semantics (matches the client adapters):
--   * a row already exists for the requested day  → update that row in place
--     (note / media only, never streaks or completed_days)
--   * the member already checked in today          → update today's row
--   * otherwise                                    → INSERT, so the trigger
--     runs the streak engine exactly once.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.duel_checkin(
  p_challenge_id uuid,
  p_note text DEFAULT '',
  p_media_url text DEFAULT NULL,
  p_media_type text DEFAULT NULL,
  p_day_number int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me         uuid := public.duel_current_profile_id();
  part       public.challenge_participants%rowtype;
  ck         public.challenge_checkins%rowtype;
  target_day int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  IF p_media_type IS NOT NULL AND p_media_type NOT IN ('image', 'video') THEN
    RAISE EXCEPTION 'media type must be image or video';
  END IF;

  IF p_media_url IS NOT NULL AND p_media_type IS NULL THEN
    RAISE EXCEPTION 'media type is required when media is attached';
  END IF;

  -- Which day is this check-in for?
  IF p_day_number IS NOT NULL THEN
    target_day := p_day_number;
  ELSE
    SELECT coalesce(max(day_number), 0) + 1 INTO target_day
      FROM public.challenge_checkins
     WHERE challenge_id = p_challenge_id AND user_id = me;
  END IF;

  IF target_day < 1 OR target_day > 365 THEN
    RAISE EXCEPTION 'day number must be between 1 and 365';
  END IF;

  -- EDIT PATH: never re-run the streak engine for an existing entry.
  SELECT * INTO ck
    FROM public.challenge_checkins
   WHERE challenge_id = p_challenge_id
     AND user_id = me
     AND (day_number = target_day OR checkin_date = CURRENT_DATE)
   ORDER BY (day_number = target_day) DESC, checkin_date DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.challenge_checkins
       SET note       = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note),
           media_url  = coalesce(p_media_url, media_url),
           media_type = coalesce(p_media_type, media_type)
     WHERE id = ck.id
     RETURNING * INTO ck;
  ELSE
    INSERT INTO public.challenge_checkins
      (challenge_id, user_id, day_number, checkin_date, note, media_url, media_type)
    VALUES
      (p_challenge_id, me, target_day, CURRENT_DATE, coalesce(p_note, ''), p_media_url, p_media_type)
    RETURNING * INTO ck;
  END IF;

  SELECT * INTO part FROM public.challenge_participants
   WHERE challenge_id = p_challenge_id AND user_id = me;

  RETURN jsonb_build_object(
    'checkin', jsonb_build_object(
      'id', ck.id, 'challenge_id', ck.challenge_id, 'day_number', ck.day_number,
      'checkin_date', ck.checkin_date, 'note', ck.note,
      'media_url', ck.media_url, 'media_type', ck.media_type,
      'created_at', ck.created_at
    ),
    'participation', jsonb_build_object(
      'challenge_id', part.challenge_id, 'status', part.status,
      'joined_at', part.joined_at, 'current_streak', part.current_streak,
      'longest_streak', part.longest_streak, 'completed_days', part.completed_days,
      'last_checkin_date', part.last_checkin_date, 'completed_at', part.completed_at
    )
  );
END;
$$;

COMMIT;

-- ============================================================================
-- RESULT
--   ✔ duel_checkin() delegates streaks/completion to trg_duel_apply_checkin
--   ✔ editing a day (or re-submitting the same day) only updates note + media
--   ✔ no writes to the legacy challenge_posts tables — challenge_checkins is
--     the single source of truth for posts, the Explore feed and the
--     per-challenge timeline (see lib/duel/local.ts / lib/duel/supabase.ts)
--
-- The challenge_posts / challenge_post_media / challenge_post_likes /
-- challenge_post_comments tables from 20260922000000 are intentionally NOT
-- dropped (they may hold rows) but nothing reads or writes them any more.
-- ============================================================================
