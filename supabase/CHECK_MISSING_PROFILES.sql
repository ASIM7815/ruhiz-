-- ============================================================================
-- CHECK FOR MISSING PROFILES
-- ============================================================================
-- Quick diagnostic to see if auth.users have corresponding profiles
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'CHECKING FOR USERS WITHOUT PROFILES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo ''
\echo 'Users in auth.users:'
SELECT COUNT(*) as total_auth_users FROM auth.users;

\echo ''
\echo 'Profiles in public.profiles (excluding personas):'
SELECT COUNT(*) as total_profiles 
FROM public.profiles 
WHERE NOT is_persona;

\echo ''
\echo 'Users WITHOUT profiles:'
SELECT 
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'username' as metadata_username,
  u.raw_user_meta_data->>'display_name' as metadata_display_name,
  u.raw_user_meta_data->>'full_name' as metadata_full_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.user_id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;

\echo ''
\echo 'Existing profiles:'
SELECT 
  p.id,
  p.user_id,
  p.username,
  p.display_name,
  p.is_persona,
  p.created_at
FROM public.profiles p
ORDER BY p.created_at DESC
LIMIT 10;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TRIGGER CHECK'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

\echo ''
\echo 'Trigger on auth.users:'
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'on_auth_user_created';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'DIAGNOSIS COMPLETE'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'If you see users without profiles, run: supabase/FIX_LOGIN_STUCK.sql'
\echo ''
