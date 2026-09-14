-- Check YOUR specific profile (the ironman user)

-- 1. Show your full profile details
SELECT 
  'YOUR PROFILE:' as type,
  p.id as profile_id,
  p.user_id,
  p.username,
  p.display_name,
  p.bio,
  p.is_persona,
  u.email,
  p.created_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.username = 'ironman'
ORDER BY p.created_at DESC;

-- 2. Check if "ironman" is marked as a persona (demo) or real user
SELECT 
  'IS IT A DEMO PROFILE?' as check,
  username,
  display_name,
  CASE 
    WHEN user_id IS NULL THEN '❌ DEMO/PERSONA (no user_id)'
    WHEN is_persona = true THEN '❌ DEMO/PERSONA (is_persona = true)'
    ELSE '✅ REAL USER'
  END as profile_type,
  user_id,
  is_persona
FROM profiles
WHERE username = 'ironman';

-- 3. Check all profiles with user_id (real users, not personas)
SELECT 
  'ALL REAL USERS:' as type,
  username,
  display_name,
  user_id,
  email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.user_id IS NOT NULL
ORDER BY p.created_at DESC;
