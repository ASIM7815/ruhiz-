# Fix: Moment posting failure (RLS violation on `post_problems`)

## Symptom

Posting a Moment failed with the toast *"Post failed to save to Ruhiz. Please try again."*
The underlying Supabase error returned to the client was:

```
code:    42501
message: new row violates row-level security policy for table "post_problems"
```

The `INSERT INTO public.posts` was rolled back entirely — no row was ever saved.
Text, photo and video posts were all affected because they share the same insert flow.

Confusing detail: a post whose text hit **no classifier keywords at all** (e.g. "Hello
world") could succeed, while any typical mental-health moment ("anxious", "exam",
"grateful", "healing", most topics…) failed. That is why posting looked intermittent.

## Full flow trace

1. `components/post/CreatePostModal.tsx` → `store.createPost({ type: 'moment', text, topics })`
2. `lib/store.tsx createPost()` → supabase-js
   `from('posts').insert({ user_id: <profiles.id>, type, content, image_url, video_url, topics }).select('*').single()`
   — i.e. `INSERT INTO public.posts … RETURNING *` over PostgREST as role `authenticated`
   with the member's JWT (`auth.uid()` = `auth.users.id`).
3. RLS `posts_insert` policy: `with check (user_id = public.current_profile_id())` — **passes**
   (the app correctly inserts the member's `profiles.id`, and `current_profile_id()` is a
   `SECURITY DEFINER` lookup of `profiles.id` by `auth.uid()`).
4. `AFTER INSERT` trigger `trg_classify_post` fires `public.fn_classify_post()`, which
   inserts auto-classified rows into `public.post_problems`.

## Root cause (database)

`public.post_problems` has RLS enabled with a **select-only** policy (it is derived,
trigger-maintained data — users must never write it directly). That is correct and was kept.

But `fn_classify_post()` was the **only trigger function in the schema created without
`SECURITY DEFINER`** (compare `fn_bump_counter`, `fn_notify`, `fn_notify_message`,
`fn_notify_mentions` — all definer). So the trigger body executed as the posting member's
`authenticated` role, the `INSERT INTO post_problems` matched no policy, PostgreSQL raised
`42501`, and the whole post insert rolled back.

Why nobody saw this in seed/demo data: migrations run as `postgres`, the table **owner**,
which bypasses RLS — so the seeded posts classified fine while every real user post failed.

A second, independent SQL bug: the seed section of
`20260913000000_ruhiz_production.sql` still referenced the removed video posts
`b…0008 / b…0013 / b…0016` (comments, supports, saves, been_there, activities). Any fresh
run — or any re-run after `remove_video_posts.sql` — aborted with
`23503 … violates foreign key constraint "comments_post_id_fkey"`, so the "idempotent"
migration could no longer be applied at all.

## What was changed

### Database

1. **`supabase/migrations/20260915000000_fix_post_classify_trigger_rls.sql` (NEW — run this
   in the Supabase SQL Editor on the live project).** Idempotent hotfix that:
   - recreates `fn_classify_text()` and `fn_classify_post()` as
     `SECURITY DEFINER … SET search_path = public` (same trusted-function pattern as every
     other trigger in the schema);
   - re-attaches the canonical `trg_classify_post` trigger;
   - backfills `post_problems` for all existing posts (deterministic reclassification);
   - self-verifies (raises an exception if the function is not definer / trigger missing).
2. **`supabase/migrations/20260913000000_ruhiz_production.sql`** — fixed at the source so
   fresh installs are correct:
   - both classifier functions now created `SECURITY DEFINER` with pinned `search_path`;
   - removed all seed rows referencing the deleted video posts (FK-safe re-runs).

**No RLS policy was removed, disabled, or weakened.** `post_problems` remains user
read-only; direct writes by `authenticated`/`anon` still fail with `42501` (verified below).

### Frontend

3. **`lib/store.tsx` `createPost()`** — PostgREST errors are plain objects, not `Error`
   instances, so the composer fell back to a generic *"Something went wrong"* toast on top
   of a second generic store toast. The failure path now logs the raw DB error
   (`console.error`) and throws a single descriptive `Error`, so exactly one accurate toast
   is shown. The insert flow itself (auth user → `profiles.id` → `user_id`) was already
   correct and unchanged.

## Verification (real PostgreSQL 18, Supabase-faithful harness)

Reproduced against the exact committed migrations with a Supabase-like environment
(`anon`/`authenticated` roles, `auth.uid()` from JWT claims, RLS enforced):

- **Before fix:** keyword-bearing text/photo/video Moment inserts fail with
  `42501 … row-level security policy for table "post_problems"`, insert fully rolled back.
- **After fix (hotfix path and fresh-install path), as role `authenticated`:**
  - plain text ✅, emojis incl. ZWJ sequences/flags/skin tones (👨‍👩‍👧‍👦 🇵🇰 🫶🏽) ✅,
    special characters/HTML/quotes/`$`/`%`/backslash/中文/العربية/हिंदी ✅ (byte-identical
    round-trip), multiline `\n`/`\r\n`/tabs/blank lines ✅, ~1900-char text ✅,
    topics ✅ (classifier rows created: e.g. `studying:0.466, anxiety:0.344`),
    @mentions ✅ (notification delivered), photo post with `image_url` ✅, video post with
    `video_url` ✅, edit → reclassify ✅.
  - every new row visible through the feed/profile query
    (`status='live'`, RLS-filtered select) ✅.
- **Security regression suite (all still enforced):** direct `post_problems` insert →
  `42501` ✅; posting with someone else's `user_id` → `42501` ✅; editing/deleting other
  users' posts → 0 rows ✅; `anon` reads 0 posts ✅; `anon` insert → `42501` ✅.
- **Idempotency:** production migration re-run twice (with the demo account present),
  message-fix migration re-run, hotfix run twice — all clean ✅.

## How to deploy

1. Supabase Dashboard → SQL Editor → paste and run
   `supabase/migrations/20260915000000_fix_post_classify_trigger_rls.sql`.
2. Redeploy the app (frontend error-handling improvement is optional for the fix itself).
3. Post a Moment containing an emotion keyword (e.g. "Feeling anxious but grateful 🙏") —
   it saves, appears in the feed and on the profile immediately.
