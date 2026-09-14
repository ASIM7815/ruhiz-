-- QUICK FIX: Run this to fix permissions and missing column

-- 1. Add missing column
ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

-- 2. Grant all permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Done! Now refresh browser and login again.
