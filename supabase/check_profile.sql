-- Check if your profile exists in the database

-- 1. Find your user in auth.users
SELECT 
  'Auth Users Table:' as table_name,
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email LIKE '%mohammadasimsaad%'
ORDER BY created_at DESC;

-- 2. Find your profile in profiles table
SELECT 
  'Profiles Table:' as table_name,
  id as profile_id,
  user_id,
  username,
  display_name,
  created_at
FROM profiles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%mohammadasimsaad%'
)
ORDER BY created_at DESC;

-- 3. Count all profiles
SELECT 
  'Total Profiles:' as info,
  COUNT(*) as total_count,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as real_users,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as personas
FROM profiles;

-- 4. Show recent profiles
SELECT 
  'Recent Profiles:' as info,
  username,
  display_name,
  CASE 
    WHEN user_id IS NULL THEN 'Persona (Sample)'
    ELSE 'Real User'
  END as type,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;
