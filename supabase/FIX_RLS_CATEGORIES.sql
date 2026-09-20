-- Fix RLS permission denied for duel_categories
-- The migration enabled RLS but the policy might not allow authenticated users to read

BEGIN;

-- Ensure the table exists and RLS is enabled
ALTER TABLE public.duel_categories ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the policy to ensure it works
DROP POLICY IF EXISTS categories_read ON public.duel_categories;

-- Allow everyone (including authenticated users) to read categories
CREATE POLICY categories_read ON public.duel_categories 
  FOR SELECT 
  USING (true);

COMMIT;

-- Verify the policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,     
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'duel_categories';
