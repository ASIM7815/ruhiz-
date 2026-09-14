# 🔧 POST INSERT DIAGNOSTIC GUIDE

## The Problem
Text moments are failing to save to the database. We need to find the exact cause.

## ✅ What I've Done So Far

1. **Traced the complete flow:**
   - Frontend: `CreatePostModal.tsx` → `store.createPost()` 
   - Store: INSERT to `posts` table with `user_id: profileId`
   - Database: `posts` table with RLS policies

2. **Verified schema is correct:**
   - Table: `public.posts` exists
   - Column: `user_id` references `profiles.id`
   - RLS: Enabled with INSERT policy: `user_id = current_profile_id()`

3. **Added detailed logging:**
   - Frontend now logs the exact INSERT payload
   - Shows profile ID, content, topics, etc.

## 🎯 IMMEDIATE ACTION NEEDED

### Option 1: Run SQL Diagnostic (RECOMMENDED)
1. Go to: https://supabase.com/dashboard/project/tengfsvzcjljxhdpanvt/sql/new
2. Copy the ENTIRE contents of: `supabase/DIAGNOSE_POST_INSERT.sql`
3. Paste and click "Run"
4. **Copy ALL the output** and send it to me

This will:
- ✅ Check if you're authenticated
- ✅ Verify your profile exists
- ✅ Test the exact INSERT query
- ✅ Show the EXACT error if it fails

### Option 2: Test in Browser with Console Open
1. Go to: https://ruhiz.asimsaadz.com
2. Login with your account
3. Open DevTools Console (F12)
4. Try to create a text moment
5. **Copy ALL console logs** that start with `[POST INSERT]`
6. Send them to me

The logs will show:
```
[POST INSERT] Starting insert: { profileId, type, ... }
[POST INSERT] Insert payload: { user_id, content, ... }
[POST INSERT] Result: { success, error, ... }
```

## 🔍 What I'm Looking For

The exact error message will tell us:

**If error mentions "new record violates row-level security policy":**
- Issue: RLS policy rejecting the insert
- Fix: Update policy or check `current_profile_id()` function

**If error mentions "foreign key violation":**
- Issue: `profile.id` doesn't exist
- Fix: Re-create profile or link correctly

**If error mentions "permission denied":**
- Issue: `authenticated` role lacks INSERT grant
- Fix: Grant INSERT permission

**If NO error but post doesn't appear:**
- Issue: INSERT succeeds but SELECT policy blocks reading
- Fix: Update SELECT policy

**If console shows `profileId: null`:**
- Issue: Frontend can't get profile ID
- Fix: Check `profileIdRef` initialization in store

## 📋 Next Steps After We Get the Error

Once you send me the diagnostic output or console logs, I will:
1. Identify the EXACT root cause
2. Create the EXACT SQL fix
3. Test it works
4. Apply the fix
5. Verify text moments work end-to-end

---

**Please run ONE of the diagnostic options above and send me the output!** 🙏
