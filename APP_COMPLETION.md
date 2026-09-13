# Ruhiz — Frontend Completion (Sept 2026)

The Ruhiz frontend is now a fully functional social web app. The existing
green/white brand identity is kept, while the UX follows proven patterns from
Instagram / Threads / TikTok: persistent navigation, filterable feeds, rich
profiles, creation flows, and fully responsive layouts.

## What works

### Navigation (all functional, hash-routed: `#/home`, `#/profile/u_sarah`, …)
| Area | Behaviour |
| --- | --- |
| **Home** | Tabs **For You / Following / Photo / Video / Moment** actually filter the feed (+ topic chips on For You). Refresh, skeletons, empty states with CTAs. |
| **Explore** | Live search over people + moments, trending topics, All/People/Posts scopes, follow-in-place. |
| **My Journey** | Stats (moments, likes, supporters, streak…), milestone badges, month-by-month timeline of your own posts. |
| **Connections** | Suggestions / Supporters / Supporting tabs, search, follow / unfollow / remove follower, jump to DM. |
| **Messages** | Two-pane chat (single-pane on mobile), unread badges, typing indicator, simulated replies, send. |
| **Notifications** | Like / comment / follow / mention / support events, filters, mark-all-read, click-through to the highlighted post. |
| **Saved** | List + grid modes, lightbox, unsave. |
| **Profile** | Cover + avatar upload **with cropping** (react-easy-crop), edit-profile modal (name/username/bio/location/website), Supporters & Supporting modals, tabs Posts / Photos / Videos / Moments / Saved, other users' profiles are browsable too. |
| **Settings** | Account (edit, reset, deactivate, type-DELETE-to-confirm delete), Privacy (visibility, messaging, activity status, block list), Notifications toggles + email digest, Appearance (Light/Dark/System theme, text size, reduce motion — applied live), Security (password change, 2FA, sessions revoke). |

### Create flow
`Create Moment` opens a modal with **Photo / Video / Moment** composers:
drag-&-drop or click upload, preview, caption, up to 4 topics, upload progress.
Uploads go through the existing **Cloudflare R2 pipeline** (`/api/upload` →
R2, `/api/media` → presigned URL) and posts are inserted into the Supabase
`moments` table when those services are configured. Without credentials the app
runs in **demo mode**: everything still works using sample data +
localStorage, with graceful fallbacks (data-URL images, session-scoped videos).

### Posts
Like (with animation), “Been there” support, comments, share (copy link /
send via message / repost), save, image lightbox, video player with graceful
expired-media fallback, edit & delete for your own posts, report for others’,
read-more for long text.

## Architecture

```
components/app/        App shell: TopBar, SideNav, BottomNav, RightPanel,
                       AppShell (hash router + splash), Toasts
components/views/      Home, Explore, Journey, Connections, Messages,
                       Notifications, Saved, Profile, Settings
components/post/       PostCard (all interactions), CreatePostModal
components/ui/         Icons, Modal, Toggle, Segmented, Avatar, EmptyState,
                       skeletons…
components/profile/    ImageCropModal (react-easy-crop)
lib/store.tsx          Global state + localStorage persistence + Supabase sync
lib/data/sample.ts     Realistic sample people, posts, threads, notifications
lib/upload.ts          R2 upload with demo fallback
lib/supabase/          Guarded clients (safe stub when env vars are missing)
```

- State persists in `localStorage` (`ruhiz.app.v1`) and rehydrates on load.
- Dark mode, text size and reduce-motion are applied via CSS variables on
  `<html>` and work instantly, everywhere.
- Responsive breakpoints: mobile (bottom nav), tablet (icon rail), desktop
  (full sidebar + right panel).

## Running

```bash
npm install
npm run dev          # http://localhost:3000 → landing, /feed for the app
```

Add `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(and `R2_*` vars) to switch from demo mode to real Supabase auth + R2 storage.
The database schema lives in `supabase-schema.sql`.
