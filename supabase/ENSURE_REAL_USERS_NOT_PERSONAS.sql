-- ============================================================================
-- ENSURE REAL USERS ARE NEVER MARKED AS PERSONAS/DEMO ACCOUNTS
-- ============================================================================

-- 1. Update the handle_new_user function to explicitly set is_persona = false
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
  base := COALESCE(
    NULLIF(new.raw_user_meta_data->>'username', ''),
    split_part(COALESCE(new.email, 'member'), '@', 1)
  );
  base := regexp_replace(base, '[^a-zA-Z0-9_]', '', 'g');
  IF char_length(base) < 2 THEN base := 'member'; END IF;
  base := LEFT(base, 24);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(candidate)) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;
  
  -- ✅ EXPLICITLY set is_persona = false for all real authenticated users
  INSERT INTO public.profiles (user_id, username, display_name, is_persona)
  VALUES (
    new.id,
    candidate,
    COALESCE(
      NULLIF(new.raw_user_meta_data->>'display_name', ''), 
      NULLIF(new.raw_user_meta_data->>'full_name', ''), 
      candidate
    ),
    false  -- ✅ Real users are NEVER personas/demo accounts
  );
  RETURN new;
END $$;

-- 2. Ensure all existing profiles with user_id are NOT marked as personas
UPDATE public.profiles
SET is_persona = false
WHERE user_id IS NOT NULL
  AND is_persona = true;

-- 3. Add a check constraint to prevent real users from being marked as personas
DO $$
BEGIN
  ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS chk_real_users_not_personas;
  
  ALTER TABLE public.profiles
    ADD CONSTRAINT chk_real_users_not_personas
    CHECK (
      -- If user_id exists (real user), is_persona MUST be false
      user_id IS NULL OR is_persona = false
    );
  
  RAISE NOTICE '✅ Constraint added: Real users (with user_id) cannot be personas';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint already exists or could not be created: %', SQLERRM;
END $$;

-- 4. Verification: Show all profiles and their persona status
SELECT 
    username,
    display_name,
    CASE 
        WHEN user_id IS NOT NULL AND is_persona = false THEN '✅ REAL USER'
        WHEN user_id IS NOT NULL AND is_persona = true THEN '❌ BUG: Real user marked as persona!'
        WHEN user_id IS NULL AND is_persona = true THEN '👤 Demo/Persona Account (correct)'
        WHEN user_id IS NULL AND is_persona = false THEN '⚠️ Demo without persona flag'
        ELSE '❓ Unknown state'
    END as account_type,
    user_id IS NOT NULL as has_auth,
    is_persona,
    created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 20;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ REAL USER PROTECTION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'All real authenticated users:';
    RAISE NOTICE '- Have is_persona = false';
    RAISE NOTICE '- Cannot be marked as personas (enforced by constraint)';
    RAISE NOTICE '- Will NEVER appear as demo accounts';
    RAISE NOTICE '';
    RAISE NOTICE 'Demo accounts:';
    RAISE NOTICE '- Have user_id = NULL';
    RAISE NOTICE '- Have is_persona = true';
    RAISE NOTICE '- Are seeded data only';
    RAISE NOTICE '';
END $$;
