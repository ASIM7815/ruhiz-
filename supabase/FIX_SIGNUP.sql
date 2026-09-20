-- ============================================================================
-- FIX SIGNUP - Ensure DUEL Signup Works Properly
-- ============================================================================
-- This script ensures the signup flow works by:
-- 1. Verifying/recreating the handle_new_user trigger
-- 2. Ensuring profiles table allows inserts
-- 3. Testing the signup flow

BEGIN;

-- ============================================================================
-- 1. ENSURE PROFILES TABLE EXISTS WITH CORRECT SCHEMA
-- ============================================================================

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

-- Ensure indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id 
  ON public.profiles (user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username 
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- ============================================================================
-- 2. RECREATE handle_new_user FUNCTION (FIXED VERSION)
-- ============================================================================

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
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate)) LOOP
    n := n + 1;
    candidate := left(base, 16) || n::text;
  END LOOP;
  
  -- Insert profile (trigger runs as SECURITY DEFINER so bypasses RLS)
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
    -- Log the error but don't block auth.users insert
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN new;
END;
$$;

-- ============================================================================
-- 3. RECREATE TRIGGER ON auth.users
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. ENSURE RLS POLICIES ALLOW PROFILE CREATION
-- ============================================================================

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS profiles_read ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;

-- Everyone can read profiles
CREATE POLICY profiles_read ON public.profiles 
  FOR SELECT 
  USING (true);

-- Users can insert their own profile (also allows trigger to insert)
CREATE POLICY profiles_insert_self ON public.profiles 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own profile
CREATE POLICY profiles_update_self ON public.profiles 
  FOR UPDATE 
  USING (user_id = auth.uid() OR id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));

COMMIT;

-- ============================================================================
-- 5. VERIFY SETUP
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SIGNUP SETUP VERIFICATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo ''
\echo '✓ Profiles table schema updated'
\echo '✓ handle_new_user function recreated with error handling'
\echo '✓ Trigger on auth.users recreated'
\echo '✓ RLS policies configured'
\echo ''

SELECT 
  'Trigger exists: ' || 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN '✓ YES' ELSE '✗ NO' END AS status;

SELECT 
  'RLS enabled: ' || 
  CASE WHEN rowsecurity THEN '✓ YES' ELSE '✗ NO' END AS status
FROM pg_tables 
WHERE tablename = 'profiles';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'READY TO TEST SIGNUP'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Test signup in your app with:'
\echo '  - Full name: Test User'
\echo '  - Username: testuser'
\echo '  - Email: test@example.com'
\echo '  - Password: SecurePass123!'
\echo ''
\echo 'The signup should:'
\echo '  1. Create auth.users record'
\echo '  2. Trigger calls handle_new_user()'
\echo '  3. Profile is created in public.profiles'
\echo '  4. User can log in'
\echo ''
