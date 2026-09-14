-- Fix: Add missing joined_at column to conversation_participants table
-- This column was added to the schema but your table doesn't have it yet

-- Add the column if it doesn't exist
ALTER TABLE public.conversation_participants 
ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

-- Verify the fix
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'conversation_participants' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- You should now see: conversation_id, user_id, last_read_at, joined_at
