# 🚀 Ruhiz Authentication - Quick Start Guide

## 🎯 What You Need to Do NOW

### Step 1: Create Database Table (5 minutes)

1. Open Supabase SQL Editor:
   ```
   https://tengfsvzcjljxhdpanvt.supabase.co/project/default/sql
   ```

2. Paste and run this SQL:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table
create table if not exists profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade unique not null,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 20),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]+$')
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select using ( true );

create policy "Users can insert their own profile."
  on profiles for insert with check ( auth.uid() = user_id );

create policy "Users can update own profile."
  on profiles for update using ( auth.uid() = user_id );

create index if not exists profiles_username_idx on profiles (lower(username));

create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_profiles_updated_at
  before update on profiles
  for each row execute procedure handle_updated_at();
```

3. Click **"Run"** ✅

---

### Step 2: Configure Supabase (2 minutes)

1. Go to **Authentication → URL Configuration**
2. Add these to "Redirect URLs":
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/reset-password
   ```

3. Go to **Authentication → Email Templates**
4. Verify "Confirm signup" template is active
5. Verify "Reset password" template is active

---

### Step 3: Test It! (5 minutes)

```bash
# Start dev server
npm run dev
```

#### Test Signup:
1. Go to: `http://localhost:3000/signup`
2. Fill in:
   ```
   Username: TestUser123
   Email: your@email.com
   Password: test1234
   Confirm: test1234
   ```
3. Click "Create Account"
4. ✅ Should see email confirmation screen
5. Check your email
6. Click verification link
7. ✅ Should redirect to feed

#### Test Login:
1. Go to: `http://localhost:3000/login`
2. Enter email + password
3. Click "Log In"
4. ✅ Should go to feed

#### Test Forgot Password:
1. Go to: `http://localhost:3000/login`
2. Click "Forgot password?"
3. Enter your email
4. Click "Send reset link"
5. Check your email
6. Click reset link
7. Enter new password
8. ✅ Should work!

---

## 📝 Key Points to Remember

### User Signs Up With:
```
✅ Username (e.g., QuietMoon)
✅ Email (e.g., user@gmail.com)
✅ Password (Ruhiz password, NOT Gmail password)
```

### User Logs In With:
```
✅ Email + Ruhiz Password
❌ NOT Username + Password
```

### User Identity:
```
Internal: UUID from Supabase Auth
Public: @Username from profiles table
```

---

## 🔍 Troubleshooting

### "Username already taken"
- Username must be unique (case-insensitive)
- Try different username

### "Email not confirmed"
- Check spam folder
- Click "Resend verification email"

### "Email or password is incorrect"
- Double-check email spelling
- Make sure you're using Ruhiz password (not Gmail)

### "Failed to create profile"
- Run the SQL schema first
- Check Supabase table permissions

---

## 📂 Project Structure

```
/app
├── signup/page.tsx                  ✅ Complete signup with username
├── login/page.tsx                   ✅ Email + password login
├── confirm-email/page.tsx           ✅ Email verification screen
├── forgot-password/page.tsx         ✅ Password recovery
├── reset-password/page.tsx          ✅ New password entry
├── setup-profile/page.tsx           ✅ Profile creation fallback
└── auth/callback/route.ts           ✅ Email verification callback

/lib/supabase
├── client.ts                        ✅ Client-side Supabase
└── server.ts                        ✅ Server-side Supabase

middleware.ts                        ✅ Route protection
.env.local                          ✅ Environment variables
```

---

## 🎨 Design Features

✅ Matches existing Ruhiz green theme
✅ Responsive (mobile, tablet, desktop)
✅ Loading states on all buttons
✅ User-friendly error messages
✅ Password visibility toggles
✅ Clear labels and placeholders

---

## 🔐 Security Features

✅ Supabase handles all passwords
✅ No passwords in database
✅ Session-based authentication
✅ Protected routes
✅ Email verification required
✅ HTTPS-only in production

---

## ✅ What's Working

- [x] User signup with username
- [x] Email confirmation
- [x] User login with email
- [x] Forgot password
- [x] Reset password
- [x] Profile creation
- [x] Session persistence
- [x] Protected routes
- [x] Logout
- [x] Error handling
- [x] Loading states

---

## 📖 Documentation

- **Full Guide**: `AUTHENTICATION_COMPLETE.md`
- **Database Schema**: See Step 1 above
- **Supabase Docs**: https://supabase.com/docs/guides/auth

---

## 🎉 You're Ready!

Your Ruhiz authentication is complete and ready to use. Just:

1. ✅ Run the SQL (Step 1)
2. ✅ Configure redirects (Step 2)  
3. ✅ Test it (Step 3)

That's it! 🚀

---

**Need Help?** Check `AUTHENTICATION_COMPLETE.md` for detailed information.
