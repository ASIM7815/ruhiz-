# DUEL — Challenge A Better You

DUEL is a production-grade social platform for **personal challenges**: create, discover,
join and complete duels like *30 Days Coding*, *21 Days Fitness*, *7 Days No Social Media*
or *30 Days Reading* — then prove it with daily check-ins, streaks and trophies.

This repository was rebuilt from the ground up on top of the previous product's
useful infrastructure (Supabase auth, Cloudflare R2 media pipeline, Next.js 15 app
router, SSR session middleware). Everything else — branding, data model, taxonomy,
recommendation system, UI — is DUEL.

---

## The nine tabs

| Tab | What it does |
| --- | --- |
| **Home** | Greeting + streak summary, "continue your duels", behaviour-ranked recommendations, trending challenges, latest check-ins |
| **Explore** | Search (recorded as a recommendation signal), category / duration / sort filters, category directory |
| **Create Challenge** | Full validated form: title, description, category, duration (1–365d), difficulty, daily task, tags, cover upload (R2 presigned PUT) — also the editor for your own challenges |
| **My Challenges** | Active / Completed / Created / Saved lists |
| **Progress** | Streak & check-in stats, 14-day activity chart, per-duel progress, achievements |
| **Notifications** | Likes, comments, joins, completions, streak alerts, messages — realtime in production |
| **Messages** | 1-to-1 conversations with read receipts and unread badges |
| **Profile** | Cover, avatar, bio, stats, created & joined challenges, edit modal with avatar/cover upload |
| **Settings** | Theme / type scale / motion, notification prefs, privacy, blocks, security, data export, reset |

Every button is wired: join, leave, check in, like, save, share (clipboard link),
comment, delete comment, message creator, not-interested, block, export, reset.

## Recommendation system

Behaviour-driven, on both client (`lib/duel/recommend.ts`) and server
(`duel_refresh_recommendations()` / `duel_recommend()` in SQL), from the same weights:

```
view 1 · like 3 · save 4 · comment 3 · join 6 · checkin 2
complete 8 · share 3 · search 2.5 · create 4 · leave −3 · not_interested −9
```

Score = 36% category affinity + 12% duration-bucket fit + 30% popularity +
10% engagement rate + 12% freshness + stable per-user jitter.
**Diversity** is enforced at selection time (round-robin across categories,
≤3 per category per page in SQL). **Cold start** (zero history) returns a balanced
mixture of every category ordered by global popularity. Each recommendation carries a
human-readable reason ("Because you joined 30 Days Coding", "Trending in Fitness…").

## Data flow

```
UI (components/views/*)
  → store (lib/duel/store.tsx)
  → adapter (lib/duel/adapter.ts)
      ├─ LocalAdapter   lib/duel/local.ts      preview / offline: full relational
      │                                        engine in localStorage (streaks,
      │                                        counters, notifications, demo auth)
      └─ SupabaseAdapter lib/duel/supabase.ts  production: Postgres + RLS + Realtime
  → Supabase / R2 (app/api/upload/*, app/api/media)
  → response → store snapshot → UI
```

With no `NEXT_PUBLIC_SUPABASE_*` env vars the app runs in **preview mode**: accounts,
challenges, check-ins and streaks persist in the browser and a seeded community reacts
to your actions, so the entire product is testable end-to-end without a backend.

### One entry, every surface

A check-in (`challenge_checkins`) *is* the post. The same row powers the streak engine,
the challenge's day-by-day timeline, the Explore media feed and profile grids — so the
social layer can never drift away from the progress data:

- `loadChallengePosts(challengeId)` → every entry of a duel in day order (media optional,
  caption-only days included). This drives the **Day-by-Day Timeline** in the challenge
  detail view.
- `loadFeed(...)` → the same rows filtered to entries that carry a photo/video, ranked
  for discovery (Explore).
- Posting and editing always go through the check-in flow (`CheckinModal` → `checkin()`):
  one entry per member per day. Likes and comments are stored per check-in
  (`checkin_likes` / `checkin_comments`) and are shared by every surface.

In production `duel_checkin()` inserts the row and lets the `trg_duel_apply_checkin`
trigger own streaks/completion; when the day already has an entry the RPC updates just
the note/media, so editing proof never re-runs the streak maths.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — fill Supabase + R2 to go live
npm run dev
```

1. **Preview mode (no env):** open `/`, sign up, and use everything locally.
2. **Production:** fill `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   run `supabase/duel/INSPECT_BEFORE_MIGRATION.sql` (read-only report of what
   will be preserved vs deleted), then apply
   `supabase/migrations/20260920000000_duel_platform.sql`.
   The migration deletes the old posts / mental-health taxonomy / old recommendation
   state, keeps `auth.users`, `profiles`, conversations and messages, creates the DUEL
   schema (categories, challenges, participants, checkins, likes, saves, shares,
   comments, activities, searches, affinity, recommendations, notifications) with
   indexes, constraints, triggers and RLS, and seeds 10 categories + 18 challenges.
   Then apply `supabase/migrations/20260922200000_fix_checkin_engine.sql` — it restores
   the thin, edit-aware `duel_checkin()` RPC (an earlier branch had copied the streak
   engine into the function, which made every check-in fail against the trigger).
3. **Media:** add the four `R2_*` vars + bucket CORS for permanent cover/avatar uploads
   (presigned PUT, MIME allow-list, 8 MB cap, user-scoped keys).

## Security & production checklist

- SSR session middleware protects `/feed`; logged-in users are bounced from `/login`.
- RLS on every DUEL table; counters/streaks/completion maintained by DB triggers.
- Uploads: server-minted presigned URLs bound to key + content-type, size/MIME caps.
- Validation everywhere (forms, check-in once per day, ownership checks on edit/delete,
  media type required whenever media is attached).
- Loading skeletons, empty states, error toasts, optimistic UI with rollback on failure.
- SEO metadata, OpenGraph/Twitter cards, favicon set, theme-color, semantic headings.
- Responsive: desktop side nav + right rail, tablet, and mobile bottom nav with a
  center create action.

## Tests

```bash
npm test        # engine + UI suites, no browser required
```

- `scripts/test/duel-engine.test.cjs` — 64 assertions over the local adapter: signup,
  challenges, check-ins, streaks, performance scoring, feed ranking, timeline ordering,
  likes/comments and permissions.
- `scripts/test/timeline-ui.test.cjs` — renders the real `ChallengeDetailView` in jsdom
  against the real store, then asserts the day-by-day timeline shows every entry
  (photo and caption-only), that likes reach the shared snapshot, and that "Edit entry"
  opens the pre-filled check-in modal.

## Layout

```
app/                  routes: landing, auth, /feed (the app), API (upload/media)
components/app/       shell, top bar, side nav, bottom nav, right rail, toasts
components/views/     the nine tabs + challenge detail
components/challenge/ card, detail pieces, check-in modal, comments
components/ui/        icons, primitives, logo, media resolver
lib/duel/             types, seed, recommendation engine, adapters, store
lib/supabase/         browser / server / middleware clients
lib/r2/               Cloudflare R2 client
supabase/migrations/  duel_platform (RUHIZ → DUEL), fix_checkin_engine,
                      legacy challenge_posts migrations (schema kept, unused)
supabase/duel/        INSPECT_BEFORE_MIGRATION.sql
public/images/        official logo artwork + generated category covers
```
