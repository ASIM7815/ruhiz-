# RUHIZ

A social platform built around real problems: people share problems, experiences and evidence, discuss them in a structured way, propose Solution Cards, offer help, and move toward documented outcomes.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Neon Postgres · Neon Auth · Neon Object Storage

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run db:migrate           # creates the schema (safe to re-run)
npm run storage:setup        # sets CORS on the existing `images` and `video` buckets
npm run dev
```

## Deploy to Vercel

1. Import the GitHub repo in Vercel (framework: Next.js, no build settings to change).
2. Add every variable from `.env.example` under **Settings → Environment Variables**:
   - `NEON_DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (generate a new 32+ character secret for production)
   - `APP_ORIGIN` = your production URL, e.g. `https://ruhiz.vercel.app`
   - `NEON_STORAGE_*` for photo and video uploads
3. In the **Neon Console → Auth → Configuration**, add your production URL to **Trusted origins**. Without this, sign-in from the deployed site is rejected.
4. Run `npm run db:migrate` once against the production database (from your machine with production env vars).
5. Re-run `npm run storage:setup` with `APP_ORIGIN` set to the production URL so browsers can upload to the buckets.

`vercel.json` pins functions to `cle1` (Cleveland), next to the Neon database in `us-east-2`, to keep database round-trips short.

## Architecture

```
Browser ──► /api/* route handlers ──► session check (Neon Auth) ──► authorization ──► Neon Postgres / Object Storage
```

- No secrets reach the browser. No variable uses the `NEXT_PUBLIC_` prefix.
- Ownership always comes from the server-side session, never from request bodies.
- Administrators are exactly two verified email addresses, checked against the database on every admin request (`src/server/session.ts`).
- Mutating requests require a same-origin `Origin` header (CSRF protection) and are rate limited per user.
- Media is uploaded with short-lived presigned URLs, verified by file signature, and served only to signed-in members via signed redirects.

## Database

Migrations live in `db/migrations` and are applied by `npm run db:migrate` (tracked in `schema_migrations`). The feed ranking algorithm is documented in `docs/feed-algorithm-and-support-roles.md`. Its signals are stored in `post_stats`, `user_category_interest`, `user_kind_preference`, `interaction_events` and `post_impressions`.
