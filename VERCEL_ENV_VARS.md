# 🚀 Vercel Environment Variables - PRODUCTION READY

## 📋 Copy these EXACT values to Vercel Dashboard

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

---

---

## 🔐 IMPORTANT SECURITY NOTES

### ✅ PUBLIC Variables (Safe to expose)
- `NEXT_PUBLIC_SUPABASE_URL` - Public URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon JWT token (protected by RLS)
- `R2_PUBLIC_URL` - Public read URL for media

### 🚨 SECRET Variables (NEVER expose client-side)
- `R2_ACCOUNT_ID` - Keep server-side only
- `R2_ACCESS_KEY_ID` - Keep server-side only
- `R2_SECRET_ACCESS_KEY` - Keep server-side only
- `R2_BUCKET_NAME` - Keep server-side only

**✅ All R2 variables are correctly prefixed without `NEXT_PUBLIC_` so they stay server-side only!**

---

## 📝 How to Add in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to:** https://vercel.com/dashboard
2. **Select** your project (ruhiz)
3. **Click** Settings → Environment Variables
4. **Add each variable:**
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://tengfsvzcjljxhdpanvt.supabase.co`
   - Environment: **Production, Preview, Development** (check all 3)
   - Click **Save**
5. **Repeat** for all 7 variables above

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add R2_ACCOUNT_ID production
vercel env add R2_ACCESS_KEY_ID production
vercel env add R2_SECRET_ACCESS_KEY production
vercel env add R2_BUCKET_NAME production
vercel env add R2_PUBLIC_URL production

# Paste the values when prompted
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Before Deploying:

- [x] ✅ Code pushed to GitHub
- [ ] ✅ Environment variables added to Vercel
- [ ] ✅ Supabase database migrated (run `20260913000000_ruhiz_production.sql`)
- [ ] ✅ Supabase redirect URLs configured
- [ ] ✅ Resend SMTP configured (for email verification)

### Supabase Dashboard Configuration:

#### 1. Add Redirect URLs
Go to: https://supabase.com/dashboard/project/tengfsvzcjljxhdpanvt/auth/url-configuration

Add these URLs:
```
https://your-domain.vercel.app/auth/callback
https://your-domain.vercel.app/auth/verified
```

**Replace `your-domain.vercel.app` with your actual Vercel deployment URL!**

#### 2. Configure Resend SMTP (Optional but recommended)
Go to: https://supabase.com/dashboard/project/tengfsvzcjljxhdpanvt/settings/auth

Scroll to **SMTP Settings**:
```
Host: smtp.resend.com
Port: 587
User: resend
Password: [Your Resend API Key from https://resend.com/api-keys]
Sender Email: noreply@yourdomain.com
Sender Name: Ruhiz
```

---

## 🧪 TESTING AFTER DEPLOYMENT

### 1. Test Signup Flow
```
1. Go to: https://your-domain.vercel.app/signup
2. Create account with new email
3. Verify email works
4. Login successfully
5. See your real profile (not demo Iron Man)
```

### 2. Test Login Flow
```
1. Go to: https://your-domain.vercel.app/login
2. Login with existing credentials
3. Redirects to /feed
4. Shows your real posts and profile
```

### 3. Test Production Data
```
1. Open browser console (F12)
2. Look for: [Ruhiz] Production data loaded successfully!
3. Verify no demo fallback errors
```

---

## 🐛 TROUBLESHOOTING

### Issue: "Supabase is not configured"
**Fix:** Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel

### Issue: "Video unavailable"
**Fix:** Run `supabase/remove_video_posts.sql` to delete demo video posts

### Issue: Still seeing demo Iron Man
**Fix:** Run `supabase/fix_username_conflict.sql` to change your username

### Issue: Email verification not working
**Fix:** Configure Resend SMTP in Supabase settings or disable email confirmation temporarily

---

## 📊 PRODUCTION URLS

**After deployment, your Ruhiz app will be live at:**
```
https://ruhiz.vercel.app
or
https://your-custom-domain.com
```

**GitHub Repo:**
```
https://github.com/ASIM7815/ruhiz-
```

**Supabase Dashboard:**
```
https://supabase.com/dashboard/project/tengfsvzcjljxhdpanvt
```

---

## 🎉 WE DID IT BRO! 🎉

Your app is **PRODUCTION READY**! 🔥

Just add these env vars to Vercel, deploy, and you're LIVE! 🚀

---

## 📞 NEED HELP?

If anything breaks in production:
1. Check Vercel logs: Dashboard → Deployments → View Function Logs
2. Check browser console for `[Ruhiz]` errors
3. Verify all env vars are set correctly
4. Make sure Supabase SQL migration was run

**LET'S GOOOO! 🎊🎊🎊**
