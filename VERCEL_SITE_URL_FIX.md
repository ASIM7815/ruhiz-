# 🔧 Fix Email Verification Redirect to Production Domain

## 🚨 ISSUE
Email verification links are redirecting to `localhost` instead of your production domain `ruhiz.asimsaadz.com`

## ✅ SOLUTION
Add one more environment variable to Vercel:

---

## 📝 ADD THIS TO VERCEL

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

### New Variable to Add:

```bash
# Production Site URL
NEXT_PUBLIC_SITE_URL=https://ruhiz.asimsaadz.com
```

**Environment:** Check all 3:
- ✅ Production
- ✅ Preview
- ✅ Development

---

## 🔄 AFTER ADDING THE VARIABLE

1. **Redeploy** your project (Vercel will auto-redeploy when you save the env var)
2. **OR** manually trigger a redeploy: Deployments → Click ⋯ → Redeploy

---

## ✅ UPDATED ENVIRONMENT VARIABLES LIST

Here's the complete list (8 variables total):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tengfsvzcjljxhdpanvt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlbmdmc3Z6Y2psanhoZHBhbnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzMwOTIsImV4cCI6MjEwNDgwOTA5Mn0.gxUndJtcU16fGz0aytFWL7uGZevsYQe-u6b_PvaSdQo

# Site URL (NEW!)
NEXT_PUBLIC_SITE_URL=https://ruhiz.asimsaadz.com

# Cloudflare R2
R2_ACCOUNT_ID=d337a7fca733beca44ce717ee45e8405
R2_ACCESS_KEY_ID=f23db1123ce4819837de17b72001bf0c
R2_SECRET_ACCESS_KEY=6eac5a7049bcb0fd179183b078916bf21fe7939e20681dcb4c0e6680b0fca1fc
R2_BUCKET_NAME=theruhiz
R2_PUBLIC_URL=https://theruhiz.d337a7fca733beca44ce717ee45e8405.r2.cloudflarestorage.com
```

---

## 🧪 HOW TO TEST

After redeploying:

1. **Go to:** https://ruhiz.asimsaadz.com/signup
2. **Create test account** with a new email
3. **Check email** - verification link should now say:
   ```
   https://ruhiz.asimsaadz.com/auth/callback?...
   ```
   NOT `localhost`!
4. **Click link** - should redirect to your production domain
5. **Complete verification** - should work smoothly!

---

## 📋 SUPABASE REDIRECT URLS

Make sure these are added in Supabase:

Go to: https://supabase.com/dashboard/project/tengfsvzcjljxhdpanvt/auth/url-configuration

**Add these URLs:**
```
https://ruhiz.asimsaadz.com/auth/callback
https://ruhiz.asimsaadz.com/auth/verified
http://localhost:3000/auth/callback
http://localhost:3000/auth/verified
http://localhost:3001/auth/callback
http://localhost:3001/auth/verified
```

---

## 🎉 AFTER THIS FIX

✅ Email verification will redirect to `ruhiz.asimsaadz.com`  
✅ No more localhost in production emails  
✅ Smooth signup flow from start to finish  

---

**PUSH THIS CODE + ADD ENV VAR = FIXED! 🔥**
