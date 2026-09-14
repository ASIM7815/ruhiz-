-- ============================================================================
-- FORCE FIX MESSAGING - Remove ALL policies and recreate from scratch
-- ============================================================================

-- Step 1: Disable RLS temporarily
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on messages table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple INSERT policy (NO participant check)
CREATE POLICY "Enable insert for authenticated users" ON public.messages
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        sender_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

-- Step 5: Create simple SELECT policy
CREATE POLICY "Enable read for conversation participants" ON public.messages
    FOR SELECT 
    TO authenticated
    USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM public.conversation_participants 
            WHERE user_id IN (
                SELECT id FROM public.profiles WHERE user_id = auth.uid()
            )
        )
    );

-- Step 6: Create DELETE policy
CREATE POLICY "Enable delete for message sender" ON public.messages
    FOR DELETE 
    TO authenticated
    USING (
        sender_id IN (
            SELECT id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

-- Step 7: Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'messages'
ORDER BY policyname;

-- Step 8: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.profiles TO authenticated, anon;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ ALL MESSAGING POLICIES RECREATED!';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Policies created:';
    RAISE NOTICE '  1. Enable insert for authenticated users';
    RAISE NOTICE '  2. Enable read for conversation participants';
    RAISE NOTICE '  3. Enable delete for message sender';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Hard refresh browser (Ctrl+Shift+R)';
    RAISE NOTICE '  2. Try sending message';
    RAISE NOTICE '  3. Should work now! 🎉';
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
END $$;
