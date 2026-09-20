# DUEL Signup Fix - RUHIZ to DUEL Migration

## Problem

Users getting "Database error saving new user" when signing up. Browser console shows:
```
POST /auth/v1/signup → 500
```

## Root Cause Analysis

The platform was migrated from RUHIZ (mental health) to DUEL (challenge tracking), but the authentication trigger may not have been properly applied or is encountering an error during profile creation.

### What Should Happen

1. User fills signup form (full name, username, email, password)
2. Frontend calls `supabase.auth.signUp()` with metadata:
   ```javascript
   supabase.auth.signUp({
     email,
     password,
     options: {
       data: {
         username: username,
         display_name: fullName  // Note: using display_name, not full_name
       }
     }
   })
   ```
3. Supabase Auth creates record in `auth.users`
4. Database trigger `on_auth_user_created` fires
5. Trigger calls `handle_new_user()` function
6. Function creates profile in `public.profiles` table
7. Signup succeeds

### Current Implementation

**Signup Code** (`lib/duel/store.tsx`):
```typescript
const { data, error } = await createClient().auth.signUp({
  email: input.email,
  password: input.password,
  options: { 
    data: { 
      username: input.username, 
      display_name: input.name  // ✓ Correct
    } 
  },
});
```

**Trigger Function** (`supabase/migrations/20260920000000_duel_platform.sql`):
```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := coalesce(
    new.raw_user_meta_data->>'username', 
    split_part(new.email, '@', 1), 
    'duelist'
  );
  -- ... username generation logic ...
  
  insert into public.profiles (user_id, username, display_name)
  values (
    new.id, 
    candidate, 
    coalesce(
      new.raw_user_meta_data->>'display_name',  -- ✓ Checks both
      new.raw_user_meta_data->>'full_name',     -- ✓ Fallback
      candidate
    )
  )
  on conflict (user_id) do nothing;
  
  return new;
end;
$$;
```

**Profiles Table Schema**:
```sql
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  username     text,
  display_name text,  -- ✓ Correct (not full_name)
  avatar_url   text,
  -- ... other fields
);
```

## Possible Issues

### 1. Migration Not Applied
The `20260920000000_duel_platform.sql` migration may not have been run on the Supabase database.

**Solution**: Run the migration in Supabase SQL Editor.

### 2. Trigger Function Error
The `handle_new_user()` function might be throwing an error that blocks the auth.users insert.

**Solution**: Add error handling to the trigger function so it logs errors but doesn't block signup.

### 3. RLS Policy Blocking Insert
Row Level Security might be blocking the profile insert, even though the function is `SECURITY DEFINER`.

**Solution**: Ensure RLS is properly configured with policies that allow the trigger to insert.

### 4. Constraint Violation
- Unique constraint on `username` might be failing
- Foreign key constraint on `user_id` might be failing
- NOT NULL constraint might be failing

**Solution**: The trigger already handles username uniqueness. Ensure no other constraints are blocking.

## Fix Applied

Created two SQL scripts:

### 1. `supabase/DIAGNOSE_SIGNUP_ISSUE.sql`
Diagnostic script that checks:
- Profiles table schema
- Trigger existence and definition
- RLS policies
- Constraints
- Existing DUEL vs RUHIZ tables

**To run**: Copy/paste into Supabase SQL Editor

### 2. `supabase/FIX_SIGNUP.sql`
Fix script that:
- Ensures profiles table exists with correct schema
- Recreates `handle_new_user()` with error handling
- Recreates trigger on `auth.users`
- Sets up RLS policies correctly
- Enables RLS on profiles table

**To run**: Copy/paste into Supabase SQL Editor and execute

## Important Notes

### ✅ DO (What We Did)
- ✅ Use Supabase Auth for authentication (passwords, sessions, resets)
- ✅ Pass user metadata during signup (`display_name`, `username`)
- ✅ Create trigger to auto-create profile from metadata
- ✅ Store only application data in `public.profiles`
- ✅ Use `SECURITY DEFINER` on trigger function to bypass RLS

### ❌ DON'T (What We Avoided)
- ❌ Store passwords in `public.profiles` or any custom table
- ❌ Create custom password columns
- ❌ Bypass Supabase Auth
- ❌ Manually hash/verify passwords
- ❌ Store authentication tokens

## Schema Comparison

### RUHIZ (Old - Mental Health Platform)
```sql
posts
post_problems
post_supports
been_there
problems
```

### DUEL (New - Challenge Tracking Platform)
```sql
challenges
challenge_participants
challenge_checkins
challenge_likes
challenge_saves
duel_categories
```

### Preserved (Both Platforms)
```sql
profiles (updated schema)
conversations
conversation_participants
messages
```

## Testing Checklist

After running `FIX_SIGNUP.sql`:

1. ✓ Run `DIAGNOSE_SIGNUP_ISSUE.sql` to verify setup
2. ✓ Test signup in browser:
   - Full name: Test User
   - Username: testuser
   - Email: test@example.com  
   - Password: SecurePass123!
3. ✓ Check Supabase dashboard:
   - `auth.users` has new record
   - `public.profiles` has corresponding record
4. ✓ Test login with new account
5. ✓ Verify profile data appears in app

## Issue Update: Login Stuck

**NEW ISSUE DISCOVERED**: Users can login successfully but get stuck at the login page and cannot access `/feed`.

**Root Cause**: After login, the app calls `bootstrap()` which loads the user's profile from `public.profiles`. If the profile doesn't exist (because the trigger failed), the bootstrap fails and the user gets stuck.

**Solution**: Run `supabase/FIX_LOGIN_STUCK.sql` which:
- Ensures the trigger exists and works
- Creates missing profiles for existing auth.users
- Fixes RLS policies

## Next Steps

### If Signup Fails:
1. **Run Diagnostic**: Execute `supabase/DIAGNOSE_SIGNUP_ISSUE.sql`
2. **Apply Fix**: Execute `supabase/FIX_SIGNUP.sql`
3. **Test Signup**: Try creating a new account

### If Login Works But Stuck at Login Page:
1. **Check Missing Profiles**: Execute `supabase/CHECK_MISSING_PROFILES.sql`
2. **Apply Fix**: Execute `supabase/FIX_LOGIN_STUCK.sql`
3. **Test Login**: Try logging in again - you should reach `/feed`

### Verify Everything Works:
4. **Check Supabase dashboard**: Verify user has both `auth.users` and `public.profiles` records

## Files Modified

- ✅ `lib/duel/store.tsx` - Already correct (passes `display_name`)
- ✅ `app/signup/page.tsx` - Already correct (DUEL branding, community rules)
- ✅ `supabase/migrations/20260920000000_duel_platform.sql` - Complete DUEL migration
- 🆕 `supabase/DIAGNOSE_SIGNUP_ISSUE.sql` - Diagnostic queries
- 🆕 `supabase/FIX_SIGNUP.sql` - Fix script with error handling

## Contact

If signup still fails after running the fix:
1. Check browser console for exact error
2. Check Supabase logs for trigger errors
3. Run diagnostic SQL to verify database state
4. Share the error message for further debugging
