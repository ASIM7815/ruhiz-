-- ============================================================================
-- QUICK FIX: Add missing columns and fix your profile
-- ============================================================================
-- Run this in Supabase SQL Editor if the full migration fails

-- 1. Add missing joined_at column to conversation_participants
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'conversation_participants' 
      AND column_name = 'joined_at'
  ) THEN
    ALTER TABLE public.conversation_participants 
    ADD COLUMN joined_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE '✅ Added joined_at column';
  ELSE
    RAISE NOTICE '⏭️  joined_at column already exists';
  END IF;
END $$;

-- 2. Add email column to profiles (optional, for future username lookup)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN email text;
    RAISE NOTICE '✅ Added email column to profiles';
  ELSE
    RAISE NOTICE '⏭️  email column already exists';
  END IF;
END $$;

-- 3. Grant all permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Fix your profile username (change from "ironman" to unique username)
UPDATE public.profiles
SET 
  username = 'mohammadasim',
  display_name = 'Mohammad Asim'
WHERE username = 'ironman'
  AND user_id IS NOT NULL
  AND user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%mohammadasimsaad%'
  );

-- 5. Verify the changes
SELECT 
  '✅ Your Profile:' as status,
  p.username,
  p.display_name,
  u.email,
  p.created_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.email LIKE '%mohammadasimsaad%';

-- 6. Check conversation_participants structure
SELECT 
  '✅ Table Structure:' as status,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversation_participants'
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Quick fix complete!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 What was done:';
  RAISE NOTICE '  ✅ Added missing joined_at column';
  RAISE NOTICE '  ✅ Granted permissions to authenticated users';
  RAISE NOTICE '  ✅ Changed your username from "ironman" to "mohammadasim"';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next steps:';
  RAISE NOTICE '  1. Refresh browser (Ctrl+Shift+R)';
  RAISE NOTICE '  2. Login with: mohammadasimsaad@gmail.com';
  RAISE NOTICE '  3. You should see YOUR profile, not demo Iron Man!';
  RAISE NOTICE '';
END $$;
