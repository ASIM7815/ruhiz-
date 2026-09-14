-- ============================================================================
-- FIX: Change your username from "ironman" to something unique
-- ============================================================================
-- Problem: Your profile has username "ironman" which conflicts with demo data

-- 1. Check current ironman profiles
SELECT 
  'Current ironman profiles:' as info,
  id,
  user_id,
  username,
  display_name,
  is_persona,
  CASE 
    WHEN user_id IS NOT NULL THEN 'REAL USER (yours!)'
    ELSE 'DEMO PERSONA'
  END as type
FROM profiles
WHERE username = 'ironman';

-- 2. Update YOUR profile to a unique username
-- Replace 'mohammadasim' with whatever username you want
UPDATE profiles
SET 
  username = 'mohammadasim',
  display_name = 'Mohammad Asim'
WHERE username = 'ironman'
  AND user_id IN (
    SELECT id FROM auth.users WHERE email LIKE '%mohammadasimsaad%'
  );

-- 3. Verify the change
SELECT 
  'Your updated profile:' as info,
  p.id,
  p.user_id,
  p.username,
  p.display_name,
  u.email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.email LIKE '%mohammadasimsaad%';

-- ============================================================================
-- SUCCESS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Username changed from "ironman" to "mohammadasim"';
  RAISE NOTICE '✅ Now your profile is unique and won''t conflict with demo data';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next: Refresh browser and login';
  RAISE NOTICE '   You should now see YOUR profile, not the demo Iron Man!';
END $$;
