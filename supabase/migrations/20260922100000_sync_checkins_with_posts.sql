-- ============================================================================
-- SYNC CHECKINS WITH POSTS
-- ============================================================================
-- When a user checks in with media, also create a challenge_post
-- This ensures the timeline shows all check-ins as posts
-- ============================================================================

BEGIN;

-- Update duel_checkin to also create challenge_post when media is provided
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
  me uuid := public.duel_current_profile_id();
  part public.challenge_participants%rowtype;
  ch public.challenges%rowtype;
  ck public.challenge_checkins%rowtype;
  milestone int;
  actual_day int;
  post_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  SELECT * INTO ch FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'challenge not found'; END IF;

  SELECT * INTO part FROM public.challenge_participants
   WHERE challenge_id = p_challenge_id AND user_id = me;
  IF NOT FOUND THEN RAISE EXCEPTION 'join the challenge before checking in'; END IF;
  IF part.status <> 'active' THEN RAISE EXCEPTION 'this challenge is already completed'; END IF;

  -- Determine day number
  actual_day := COALESCE(p_day_number, (part.completed_days + 1));

  -- Check if already checked in today
  IF part.last_checkin_date = CURRENT_DATE THEN 
    RAISE EXCEPTION 'already checked in today'; 
  END IF;

  -- Update streak
  IF part.last_checkin_date = (CURRENT_DATE - INTERVAL '1 day')::date THEN
    part.current_streak := part.current_streak + 1;
  ELSE
    part.current_streak := 1;
  END IF;

  part.longest_streak := GREATEST(part.longest_streak, part.current_streak);
  part.completed_days := part.completed_days + 1;
  part.last_checkin_date := CURRENT_DATE;

  -- Check for completion
  IF part.completed_days >= ch.duration_days THEN
    part.status := 'completed';
    part.completed_at := now();
    UPDATE public.challenges SET completion_count = completion_count + 1 WHERE id = ch.id;
  END IF;

  -- Insert checkin
  INSERT INTO public.challenge_checkins (challenge_id, user_id, day_number, checkin_date, note, media_url, media_type)
  VALUES (p_challenge_id, me, actual_day, CURRENT_DATE, COALESCE(p_note, ''), p_media_url, p_media_type)
  RETURNING * INTO ck;

  -- Update participation
  UPDATE public.challenge_participants
  SET status = part.status,
      current_streak = part.current_streak,
      longest_streak = part.longest_streak,
      completed_days = part.completed_days,
      last_checkin_date = part.last_checkin_date,
      completed_at = part.completed_at
  WHERE challenge_id = part.challenge_id AND user_id = part.user_id;

  -- **NEW: Also create a challenge_post if media is provided**
  IF p_media_url IS NOT NULL AND p_media_type IS NOT NULL THEN
    -- Create post
    INSERT INTO public.challenge_posts (challenge_id, user_id, day_number, caption)
    VALUES (p_challenge_id, me, actual_day, COALESCE(p_note, ''))
    ON CONFLICT (challenge_id, user_id, day_number) DO UPDATE
    SET caption = COALESCE(p_note, ''), updated_at = now()
    RETURNING id INTO post_id;

    -- Add media to post
    INSERT INTO public.challenge_post_media (post_id, media_type, url, sort_order)
    VALUES (post_id, p_media_type, p_media_url, 0)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Streak notifications
  milestone := part.current_streak;
  IF milestone IN (3,7,14,21,30,50,100) THEN
    INSERT INTO public.notifications (user_id, kind, challenge_id, body)
    VALUES (me, 'streak', ch.id,
            format('%s-day streak on %s. Do not break the chain.', milestone, ch.title));
  END IF;

  -- Completion notification
  IF part.status = 'completed' THEN
    INSERT INTO public.notifications (user_id, kind, challenge_id, body)
    VALUES (me, 'streak', ch.id,
            format('Challenge complete: %s. %s days, done. Badge earned.', ch.title, ch.duration_days));
    
    -- Notify creator
    INSERT INTO public.notifications (user_id, actor_id, kind, challenge_id, body)
    SELECT ch.creator_id, me, 'complete', ch.id,
           format('%s completed your challenge %s', p.display_name, ch.title)
    FROM public.profiles p WHERE p.id = me AND ch.creator_id != me;
  END IF;

  -- Track activity
  PERFORM public.duel_track('checkin', ch.id, ch.category_id,
          CASE WHEN ch.duration_days <= 7 THEN 'sprint'
               WHEN ch.duration_days <= 14 THEN 'short'
               WHEN ch.duration_days <= 30 THEN 'classic'
               ELSE 'marathon' END, NULL);

  RETURN jsonb_build_object(
    'checkin', jsonb_build_object(
      'id', ck.id, 'challenge_id', ck.challenge_id, 'day_number', ck.day_number,
      'checkin_date', ck.checkin_date, 'note', ck.note, 
      'media_url', ck.media_url, 'media_type', ck.media_type, 'created_at', ck.created_at
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
-- SUCCESS: Check-ins now sync with challenge_posts
-- When users check in with photo/video, it creates both:
--   1. challenge_checkins record (for streaks/progress)
--   2. challenge_posts record (for timeline/social feed)
-- ============================================================================
