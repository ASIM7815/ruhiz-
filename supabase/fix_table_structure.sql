-- ============================================================================
-- AGGRESSIVE FIX: Drop and recreate conversation_participants table
-- ============================================================================

-- 1. Drop the old table (this will delete any existing conversations)
DROP TABLE IF EXISTS public.conversation_participants CASCADE;

-- 2. Recreate with ALL required columns
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT '1970-01-01'::timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 3. Create index
CREATE INDEX idx_participants_user ON public.conversation_participants (user_id);

-- 4. Enable RLS
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies. conversation_participants.user_id stores
-- public.profiles.id, not auth.users.id, so compare it to current_profile_id().
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation AND cp.user_id = p_user
  );
$$;

DROP POLICY IF EXISTS cp_select ON public.conversation_participants;
CREATE POLICY cp_select ON public.conversation_participants
  FOR SELECT TO authenticated 
  USING (
    public.is_conversation_participant(conversation_id, public.current_profile_id())
  );

DROP POLICY IF EXISTS cp_insert ON public.conversation_participants;
CREATE POLICY cp_insert ON public.conversation_participants
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = public.current_profile_id());

DROP POLICY IF EXISTS cp_update ON public.conversation_participants;
CREATE POLICY cp_update ON public.conversation_participants
  FOR UPDATE TO authenticated 
  USING (user_id = public.current_profile_id());

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;

-- 7. Verify the table structure
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversation_participants' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns:
-- 1. conversation_id (uuid)
-- 2. user_id (uuid)
-- 3. last_read_at (timestamptz)
-- 4. joined_at (timestamptz) ← THIS MUST BE HERE!

-- 8. Check your profile exists
SELECT 
  'Your Profile in Database:' as check_type,
  p.id,
  p.user_id,
  p.username,
  p.display_name,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email LIKE '%mohammadasimsaad%'
ORDER BY p.created_at DESC
LIMIT 1;

-- If no results, your profile doesn't exist!

DO $$
BEGIN
  RAISE NOTICE '✅ conversation_participants table recreated with joined_at column';
  RAISE NOTICE '✅ RLS policies applied';
  RAISE NOTICE '✅ Permissions granted';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  WARNING: Any existing conversations were deleted (table was recreated)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next: Refresh browser and login to test';
END $$;
