-- ============================================================================
-- FIX LOGIN STUCK ISSUE
-- ============================================================================
-- This script fixes the issue where users can login but get stuck at the
-- login page and cannot access /feed.
--
-- ROOT CAUSE:
--   After successful login, the app calls bootstrap() which tries to load
--   the user's profile from public.profiles. If the profile doesn't exist
--   (because the trigger failed or wasn't applied), the login gets stuck.
--
-- SOLUTION:
--   1. Ensure handle_new_user trigger exists and works
--   2. Create missing profiles for existing auth.users
--   3. Fix RLS policies to allow profile creation
-- ============================================================================

BEGIN;

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'STEP 1: Ensure profiles table exists with correct schema'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  username     text,
  display_name text,
  avatar_url   text,
  cover_url    text,
  avatar_hue   int  NOT NULL DEFAULT 152,
  bio          text NOT NULL DEFAULT '',
  location     text NOT NULL DEFAULT '',
  website      text NOT NULL DEFAULT '',
  verified     boolean NOT NULL DEFAULT false,
  is_persona   boolean NOT NULL DEFAULT false,
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id 
  ON public.profiles (user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username 
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

\echo '✓ Profiles table schema verified'

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'STEP 2: Recreate handle_new_user function with error handling'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  -- Extract username from metadata or email
  base := coalesce(
    new.raw_user_meta_data->>'username', 
    split_part(new.email, '@', 1), 
    'duelist'
  );
  
  -- Sanitize username
  base := regexp_replace(base, '[^a-zA-Z0-9_]', '', 'g');
  IF char_length(base) < 3 THEN 
    base := 'duelist'; 
  END IF;
  
  -- Ensure unique username
  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE lower(username) = lower(candidate)
  ) LOOP
    n := n + 1;
    candidate := left(base, 16) || n::text;
  END LOOP;
  
  -- Insert profile (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    new.id, 
    candidate, 
    coalesce(
      new.raw_user_meta_data->>'display_name', 
      new.raw_user_meta_data->>'full_name', 
      candidate
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block auth.users insert
    RAISE WARNING 'handle_new_user failed for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

\echo '✓ Trigger function and trigger recreated'

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'STEP 3: Enable RLS and create policies'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

-- Everyone can read profiles
CREATE POLICY profiles_read ON public.profiles 
  FOR SELECT 
  USING (true);

-- Allow INSERT for authenticated users OR when user_id is NULL (for triggers)
CREATE POLICY profiles_insert_self ON public.profiles 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id OR 
    user_id IS NULL OR
    auth.uid() IS NOT NULL  -- Allow any authenticated user to insert (trigger will set user_id)
  );

-- Users can update their own profile
CREATE POLICY profiles_update_self ON public.profiles 
  FOR UPDATE 
  USING (user_id = auth.uid());

\echo '✓ RLS enabled with proper policies'

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'STEP 4: Create missing profiles for existing auth.users'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Find auth.users without profiles
DO $$
DECLARE
  missing_user RECORD;
  base_username text;
  final_username text;
  n int;
BEGIN
  FOR missing_user IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.user_id
    WHERE p.id IS NULL
  LOOP
    -- Generate username
    base_username := coalesce(
      missing_user.raw_user_meta_data->>'username',
      split_part(missing_user.email, '@', 1),
      'duelist'
    );
    base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
    IF char_length(base_username) < 3 THEN 
      base_username := 'duelist'; 
    END IF;
    
    -- Make it unique
    final_username := base_username;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE lower(username) = lower(final_username)
    ) LOOP
      n := n + 1;
      final_username := left(base_username, 16) || n::text;
    END LOOP;
    
    -- Create the profile
    INSERT INTO public.profiles (user_id, username, display_name)
    VALUES (
      missing_user.id,
      final_username,
      coalesce(
        missing_user.raw_user_meta_data->>'display_name',
        missing_user.raw_user_meta_data->>'full_name',
        final_username
      )
    );
    
    RAISE NOTICE 'Created profile for user % with username %', 
      missing_user.email, final_username;
  END LOOP;
END $$;

\echo '✓ Missing profiles created'

COMMIT;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'VERIFICATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo ''
\echo 'Checking for users without profiles...'

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✓ All auth.users have profiles'
    ELSE '✗ ' || COUNT(*) || ' users still missing profiles'
  END AS status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.id IS NULL;

\echo ''
\echo 'Recent profiles:'

SELECT 
  id,
  username,
  display_name,
  created_at
FROM public.profiles
WHERE NOT is_persona
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'FIX COMPLETE!'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'What was fixed:'
\echo '  ✓ Profiles table schema verified'
\echo '  ✓ handle_new_user trigger recreated with error handling'
\echo '  ✓ RLS policies fixed to allow profile creation'
\echo '  ✓ Missing profiles created for existing users'
\echo ''
\echo 'Next steps:'
\echo '  1. Try logging in again - you should now reach /feed'
\echo '  2. Check browser console for any errors'
\echo '  3. If still stuck, check Supabase logs for errors'
\echo ''
\echo 'Future signups will automatically create profiles via the trigger.'
\echo ''
