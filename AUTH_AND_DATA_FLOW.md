# Ruhiz Authentication & Data Loading System

## 🔐 AUTHENTICATION FLOW

### Signup Flow
```
1. User fills signup form (/signup)
   ↓
2. supabase.auth.signUp() creates auth user
   ↓
3. Redirects to /confirm-email
   ↓
4. User clicks email verification link
   ↓
5. Link goes to /auth/callback?code=XXX&next=/auth/verified
   ↓
6. exchangeCodeForSession(code) creates session + cookies
   ↓
7. Redirects to /auth/verified
   ↓
8. Profile auto-created in profiles table if missing
   ↓
9. Redirects to /feed
```

### Login Flow
```
1. User fills login form (/login)
   ↓
2. supabase.auth.signInWithPassword()
   ↓
3. Session created automatically
   ↓
4. Profile checked/created in profiles table
   ↓
5. Redirects to /feed
   ↓
6. App loads production data from Supabase
```

---

## 📊 DATA LOADING SYSTEM

The app has **3 modes**:

### 1. Demo Mode (No Auth)
- Shows sample data (Iron Man, Captain America, etc.)
- No database connection
- User NOT signed in

### 2. Demo Mode with Auth (Database Error)
- User IS signed in
- Shows sample data as fallback
- Database query failed (RLS, missing tables, etc.)
- Console shows: `[Ruhiz] Falling back to demo mode`

### 3. Production Mode (Working)
- User IS signed in
- Shows REAL data from Supabase
- All tables loaded successfully
- Console shows: `[Ruhiz] Production data loaded successfully!`

---

## 🔍 HOW TO DEBUG

### Step 1: Check Browser Console
After logging in, check for these messages:

✅ **Success:**
```
[Ruhiz] Loading production data for profile: abc-123
[Ruhiz] Fetching all profiles...
[Ruhiz] Loaded 10 profiles
[Ruhiz] Fetching posts...
[Ruhiz] Loaded 16 posts
[Ruhiz] Production data loaded successfully!
```

❌ **Failure:**
```
[Ruhiz] Production bootstrap failed: Error
[Ruhiz] Error details: { message: "...", code: "...", ... }
[Ruhiz] Falling back to demo mode. Missing schema: true/false
```

### Step 2: Identify the Error

Common errors:

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `42P01` | Table does not exist | Run SQL migration |
| `PGRST116` | No rows returned | Table is empty (expected for new users) |
| `42501` | Permission denied | Fix RLS policies |
| `23505` | Duplicate key | Username/email already exists |

---

## 🗄️ DATABASE TABLES REQUIRED

The app needs these tables to work in production mode:

### Core Tables
- ✅ `profiles` - User profiles
- ✅ `posts` - User posts
- ✅ `problems` - Life challenges/topics
- ✅ `post_problems` - Posts linked to problems
- ✅ `comments` - Post comments
- ✅ `post_supports` - Post likes/supports
- ✅ `post_saves` - Saved posts
- ✅ `been_there` - "I've been there" reactions
- ✅ `supporters` - Following/followers relationships
- ✅ `activities` - User activity feed
- ✅ `notifications` - User notifications
- ✅ `conversations` - Chat conversations
- ✅ `conversation_participants` - Chat participants
- ✅ `messages` - Chat messages

### Check if Tables Exist

Run this in Supabase SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all 14 tables listed above.

---

## 🔧 COMMON ISSUES & FIXES

### Issue 1: Shows "Iron Man" instead of real profile

**Cause:** App is in demo mode because database queries failed

**Fix:**
1. Open browser console (F12)
2. Look for `[Ruhiz] Production bootstrap failed`
3. Check the error details
4. Fix the issue (see table below)

### Issue 2: Profile not created on signup

**Cause:** Profile creation failed (RLS policy or constraint)

**Fix:**
```sql
-- Check if profile exists
SELECT * FROM profiles WHERE user_id = 'YOUR_USER_ID';

-- If missing, create manually
INSERT INTO profiles (user_id, username, display_name)
VALUES ('YOUR_USER_ID', 'testuser', 'Test User');
```

### Issue 3: No posts showing

**Cause:** Posts table empty or RLS blocking access

**Fix:**
```sql
-- Check if posts exist
SELECT COUNT(*) FROM posts;

-- Check if RLS allows reading
SELECT * FROM posts WHERE status = 'live' LIMIT 5;
```

---

## ✅ VERIFY PRODUCTION MODE IS WORKING

### Test Procedure

1. **Login** with your real email (mohdasimsaad@gmail.com)

2. **Open browser console** (F12 → Console tab)

3. **Look for these logs:**
   ```
   [Login] Sign in successful: { userId: "...", email: "..." }
   [Ruhiz] Loading production data for profile: ...
   [Ruhiz] Loaded X profiles
   [Ruhiz] Loaded Y posts
   [Ruhiz] Production data loaded successfully!
   ```

4. **Check profile shows YOUR username** (not "Iron Man")

5. **Check posts** - Should see posts from your database (not demo posts)

---

## 🛠️ RLS POLICIES REQUIRED

Your database needs these RLS policies enabled:

```sql
-- Profiles: Anyone can read, users can update their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Posts: Anyone can read live posts
CREATE POLICY "posts_select" ON posts FOR SELECT USING (status = 'live');
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comments: Anyone can read
CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- And similar policies for other tables...
```

---

## 📝 ALGORITHM EXPLAINED

### When you login:

```javascript
// 1. Authentication
supabase.auth.signInWithPassword(email, password)
  ↓ Creates session with JWT token
  ↓ Session stored in cookies

// 2. Profile Lookup/Creation
const profile = await ensureProfile(supabase, user)
  ↓ Queries: SELECT * FROM profiles WHERE user_id = ?
  ↓ If not found: INSERT INTO profiles (user_id, username, display_name)
  ↓ Returns profile object

// 3. Data Loading
try {
  // Load all profiles (including personas)
  profiles = await supabase.from('profiles').select('*')
  
  // Load all live posts
  posts = await supabase.from('posts').select('*').eq('status', 'live')
  
  // Load post relationships (problems, supports, comments, etc.)
  post_problems = await supabase.from('post_problems').select('*')
  post_supports = await supabase.from('post_supports').select('*')
  // ... etc
  
  // SUCCESS: Show production data
  setDataMode('supabase')
  
} catch (error) {
  // FAILURE: Fall back to demo data
  console.error('Failed to load production data:', error)
  setDataMode('demo')
  // Shows Iron Man, sample posts, etc.
}
```

### Why Demo Mode?

The app falls back to demo mode if:
- Tables don't exist
- RLS policies block access
- Network error
- Any query fails

This ensures the app always works (with sample data) even if database isn't set up.

---

## 🚀 NEXT STEPS

1. **Refresh your browser** - New logging is active
2. **Login again** - Check browser console
3. **Share console output** - I'll diagnose the exact issue
4. **Fix the error** - Run SQL if needed
5. **Verify production mode** - Should see your real username!

