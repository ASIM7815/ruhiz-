# 🚀 Deploy Ruhiz to Vercel - Step by Step Guide

## ⚡ QUICK DEPLOY (5 Minutes)

### Step 1: Push to GitHub ✅ DONE!
Your code is already on GitHub: https://github.com/ASIM7815/ruhiz-

### Step 2: Import to Vercel

1. **Go to:** https://vercel.com/new
2. **Click:** Import Git Repository
3. **Select:** ASIM7815/ruhiz-
4. **Click:** Import

### Step 3: Configure Project

**Framework Preset:** Next.js (auto-detected)

**Root Directory:** `./` (leave as is)

**Build Command:** `npm run build` (auto-detected)

**Output Directory:** `.next` (auto-detected)

**Install Command:** `npm install` (auto-detected)

### Step 4: Add Environment Variables

Click **Environment Variables** and add these 7 variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tengfsvzcjljxhdpanvt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbmdmc3Z6Y2psanhoZHBhbnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzMwOTIsImV4cCI6MjEwNDgwOTA5Mn0.gxUndJtcU16fGz0aytFWL7uGZevsYQe-u6b_PvaSdQo
R2_ACCOUNT_ID=d337a7fca733beca44ce717ee45e8405
R2_ACCESS_KEY_ID=f23db1123ce4819837de17b72001bf0c
R2_SECRET_ACCESS_KEY=6eac5a7049bcb0fd179183b078916bf21fe7939e20681dcb4c0e6680b0fca1fc
R2_BUCKET_NAME=theruhiz
R2_PUBLIC_URL=https://theruhiz.d337a7fca733beca44ce717ee45e8405.r2.cloudflarestorage.com
```

**For each variable:**
- Check: ✅ Production
- Check: ✅ Preview  
- Check: ✅ Development

### Step 5: Deploy!

Click **Deploy** button and wait ~2-3 minutes ⏳

---

## 🎯 AFTER DEPLOYMENT

### 1. Get Your Deployment URL

Vercel will give you a URL like:
```
https://ruhiz-xyz.vercel.app
```

### 2. Update Supabase Redirect URLs

Go to: https://supabase.com/dashboard/project/tengfsvzcjljxhdpanvt/auth/url-configuration

**Add these URLs** (replace with your actual URL):
```
https://ruhiz-xyz.vercel.app/auth/callback
https://ruhiz-xyz.vercel.app/auth/verified
```

Keep the localhost ones too:
```
http://localhost:3000/auth/callback
http://localhost:3000/auth/verified
http://localhost:3001/auth/callback
http://localhost:3001/auth/verified
```

Click **Save**

### 3. Test Your Live Site! 🎉

**Visit:** `https://ruhiz-xyz.vercel.app`

**Test Signup:**
1. Go to /signup
2. Create account
3. Verify email
4. Login
5. See your real profile! 🎊

---

## 🔧 OPTIONAL: Custom Domain

### Add Your Own Domain (e.g., ruhiz.com)

1. **Go to:** Vercel Dashboard → Your Project → Settings → Domains
2. **Add Domain:** Type `ruhiz.com` and click Add
3. **Configure DNS:** Follow Vercel's instructions
4. **Update Supabase:** Add your custom domain URLs to redirect list

---

## 🐛 TROUBLESHOOTING

### Build Failed?

**Check Vercel logs:**
- Dashboard → Deployments → View Function Logs
- Look for errors in build output

**Common fixes:**
- Make sure all env vars are added
- Check for TypeScript errors
- Verify `package.json` has all dependencies

### App Deployed but Not Working?

**Check these:**
1. ✅ All 7 env vars added to Vercel?
2. ✅ Supabase redirect URLs updated with your Vercel URL?
3. ✅ Supabase SQL migration run? (`20260913000000_ruhiz_production.sql`)
4. ✅ Browser console shows `[Ruhiz] Production data loaded successfully!`?

### Still Seeing Demo Data?

**Fix in Supabase SQL Editor:**
```sql
-- Remove video posts
DELETE FROM posts WHERE type = 'video';

-- Fix username conflict
UPDATE profiles 
SET username = 'mohammadasim' 
WHERE username = 'ironman' AND user_id IS NOT NULL;
```

---

## 🎊 SUCCESS CRITERIA

Your deployment is successful when:

✅ Site loads at your Vercel URL  
✅ Can signup with new email  
✅ Email verification works  
✅ Can login successfully  
✅ Feed shows real posts (not all demo data)  
✅ Your profile shows YOUR username (not Iron Man)  
✅ No "Video unavailable" messages  
✅ Console shows: `[Ruhiz] Production data loaded successfully!`

---

## 📊 MONITORING

**Vercel Dashboard:**
- View deployment logs
- Monitor function execution
- Check error rates
- View analytics

**Supabase Dashboard:**
- Monitor database queries
- Check auth activity
- View API usage
- Monitor storage

---

## 🚀 NEXT STEPS

After successful deployment:

1. **Share your live URL!** 🎉
2. **Test all features thoroughly**
3. **Monitor for any errors**
4. **Get feedback from users**
5. **Keep building! 💪**

---

## 💪 WE COOKED BRO!

Your app is LIVE on Vercel! 🔥🔥🔥

**GitHub:** ✅  
**Vercel:** 🚀  
**Database:** ✅  
**Authentication:** ✅  
**Production:** READY! 🎊

**LET'S GOOOOO!** 🎉🎉🎉
