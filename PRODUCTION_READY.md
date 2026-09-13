# Ruhiz — Production-Ready Build

This release makes Ruhiz production-ready across three fronts: the **deterministic
recommendation engine**, **Supabase Realtime chat**, and **production media
uploads on private Cloudflare R2** — all wired to the authenticated Supabase
user, with Support (not Like/heart) as the reaction model everywhere.

---

## 1. Run the SQL migration (when you're ready — nothing is required right now)

The complete, idempotent migration lives at:

```
supabase/migrations/20260913000000_ruhiz_production.sql
```

Open **Supabase Dashboard → SQL Editor → New query**, paste the file (or its
contents), and run it **once**. It is safe to re-run at any time.

What it creates:

| Area | Objects |
| --- | --- |
| Users | `profiles` (real users + seeded community personas), `handle_new_user` trigger |
| Content | `posts`, `post_problems` (auto-classified), `comments`, `post_supports`, `post_saves`, `been_there` |
| Recommendations | `problems` (taxonomy + keywords), `activities`, `user_problem_scores`, `record_activities()`, `get_user_problem_scores()`, `recompute_user_problem_scores()` |
| Social graph | `supporters` (supporters/supporting), `blocks` |
| Chat | `conversations`, `conversation_participants`, `messages`, `get_or_create_conversation()`, `mark_conversation_read()` |
| Notifications | `notifications` + triggers for support / comment / person-support / message / @mention |
| Security | RLS on **every** table, `SECURITY DEFINER` helpers to avoid recursive policies |
| Realtime | `supabase_realtime` publication for `messages`, `conversation_participants`, `notifications`, `posts` + private-channel authorization policy on `realtime.messages` for `dm:<conversation-id>` rooms |
| Config | `app_settings` → `recsys_weights` (tune action weights without redeploying) |
| Seed data | The existing Ruhiz demo content: 10 community personas, the 16 posts, comments, reaction counts, the demo account's interaction history, starter conversations and notifications — attributed to `mohammadasimsaad@gmail.com` when that account exists |

Until you run it, the app automatically runs in **demo mode** (sample content,
canned chat replies, local media) and shows a banner reminding you to run the
migration. As soon as the tables exist, the same app transparently switches to
live Supabase data + Realtime. If Supabase env vars aren't set at all, demo mode
still works — nothing breaks.

## 2. What the recommendation system does

Deterministic and explainable — the same input always produces the same feed.

1. **Classification** — every post is classified into problem categories by
   curated keyword lists (`lib/recsys/problems.ts` ⇄ `problems` table).
   Identical logic runs in Postgres (trigger `fn_classify_post`) and in the
   browser (`classifyPost`), normalised to category shares.
2. **Activity tracking** — `view`, `watch` (≥3s of playback), `support`,
   `comment`, `save`, `share`, `search`, `been_there`, `ignore` (scrolled past /
   hidden) and `not_interested` are recorded with configurable weights
   (`lib/recsys/engine.ts` ⇄ `app_settings.recsys_weights`).
3. **Interest scores** — per user × problem, with a 14-day half-life decay, so
   stale interests fade and recent behaviour dominates. Stored in
   `user_problem_scores`; mirrored instantly in the browser for in-session
   adaptation.
4. **Ranking** — `score = 0.40·interest + 0.22·recency + 0.14·social proof +
   0.12·content-type preference + 0.12·supporting-author`, minus seen-recently
   and not-interested penalties, plus **controlled randomness**: a seeded
   (mulberry32/FNV) noise term whose amplitude is the *exploration level*
   — ~0.85 for brand-new members (discovery-heavy) decaying to ~0.22 for
   highly-active members (relevance-dominant). Randomness is stable within a
   day and rotates daily; a diversity pass prevents topic pile-ups.
5. **Transparency** — each card can show a "why am I seeing this" reason, and
   the composer shows which categories a draft will reach.

## 3. Chat (Supabase Realtime)

- Secure 1-to-1 conversations (`get_or_create_conversation`), RLS-enforced so
  only participants can ever read or write messages.
- **postgres_changes** streams `messages`, `conversation_participants` (read
  receipts) and `notifications`; Supabase applies table RLS to every subscriber.
- **Private broadcast channels** (`dm:<conversation-id>`) carry typing
  indicators, authorized by the `ruhiz_dm_channel_auth` RLS policy on
  `realtime.messages` — only conversation participants can join.
- Presence: a global `ruhiz:online` presence channel powers the online dots and
  "Active now".
- Unread counts, read receipts ("Sent / Read"), toasts, and notification-badge
  updates are all realtime. Seeded personas auto-reply so a single demo account
  can exercise the whole chat surface.

## 4. Media uploads (private Cloudflare R2)

Flow — secrets never leave the server:

```
browser ──POST /api/upload/presign──▶ Next.js server ──▶ validates session,
                                          mime allow-list, size caps,
                                          mints unique key + presigned PUT
browser ──PUT (XHR, progress, retry)──▶ R2 directly
browser ──POST /api/upload/complete──▶ server verifies object exists (HEAD)
display ──GET /api/media?key=…──▶ server mints a 1-hour presigned GET URL
```

- Object keys are user-scoped and unique:
  `posts/<uid>/<yyyy-mm>/<uuid>.<ext>` (also `avatars/…`, `chats/…`).
- Images ≤10 MB (JPG/PNG/GIF/WebP), videos ≤50 MB (MP4/MOV/WebM) — validated on
  both client and server.
- Real upload progress, 3-attempt exponential-backoff retries, and explicit
  error states in the composer.
- Posts store the R2 *key*; `R2Image` / `R2Video` / `Avatar` resolve keys to
  short-lived signed URLs via an in-memory cache that refreshes before expiry.

One manual step (Cloudflare dashboard, not code): set the bucket **CORS policy**
from `.env.example` so the browser can PUT/GET against your origin.

## 5. Environment

Copy `.env.example` → `.env.local` and fill in the Supabase anon pair (public)
and the four R2 values (server-only). Then run the migration SQL above.

## 6. Support everywhere

- Reactions: **Support** (hand-holding-heart icon) replaces Like/Love entirely —
  DB (`post_supports`), UI, notifications, and milestones all speak "support".
- Social graph: supporters / supporting (was followers/following).
- The retired `heart` icon is aliased to the support icon so it can never
  render again.

## 7. Notes

- Legacy `components/feed` + `components/ruhiz` duplicates (old like-style UI)
  were removed; the live app is `components/app` + `components/views` +
  `components/post`.
- The legacy `moments`-based schema, if it exists in your project, is
  automatically migrated into `posts` by the SQL file.
- Settings persist locally and (in production mode) to `profiles.settings`.
- The old `/api/upload` server-relay route was replaced by the presign flow.
