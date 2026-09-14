# FIX — Video uploads succeeded but showed "Video unavailable"

## Symptom

A video upload completed and the post was created (success toast, row in
`posts`, thumbnail in the feed), but the player rendered:

> Video unavailable

…in both the feed and the profile. The earlier "fix" for this
(`supabase/remove_video_posts.sql`, referenced from `VERCEL_ENV_VARS.md`) just
deleted every video post — it removed the symptom, not the cause.

## What was traced

```
CreatePostModal → uploadMedia()          lib/upload.ts
  → POST /api/upload/presign             app/api/upload/presign/route.ts
  → XHR PUT straight to R2               (browser)
  → POST /api/upload/complete            app/api/upload/complete/route.ts
  → posts.video_url  = R2 object key     lib/store.tsx → mapPost()
  → <R2Video mediaKey={post.video}>      components/post/PostCard.tsx
      → GET /api/media?key=…             app/api/media/route.ts
      → <video src={signedUrl}>          components/ui/Media.tsx
```

Storage config, key format, RLS/permissions, the DB value and the feed's player
wiring were all correct. Two things were not.

## Root cause 1 — the signed GET URL was one R2 refuses (feed **and** profile)

`@aws-sdk/client-s3` **≥ 3.729** enables *default integrity protections*
(`requestChecksumCalculation` / `responseChecksumValidation` = `WHEN_SUPPORTED`).
That silently folds extra parameters into the canonical request of **every**
presigned URL. The repo pins `^3.1131.0`, so it was affected.

URLs the app was actually minting:

```
PUT  …&X-Amz-SignedHeaders=host&x-amz-checksum-crc32=AAAAAA%3D%3D
                            &x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject
GET  …&response-content-disposition=inline&x-amz-checksum-mode=ENABLED&x-id=GetObject
```

**Cloudflare R2 does not implement `x-amz-checksum-mode`.** A signed GET carrying
it is answered with an error instead of the object:

```
501 NotImplemented
Header 'x-amz-checksum-mode' with value 'ENABLED' not implemented
```

So `/api/media` handed the player a URL that could never stream. `<video>` fired
`onError`, `R2Video` set `failed = true`, and the fallback
`<p>Video unavailable</p>` was rendered — for a file that was sitting in the
bucket, intact, with the right Content-Type.

The PUT side explains the "upload succeeded" half: `x-amz-checksum-crc32=AAAAAA==`
is the CRC32 of an **empty** body (the SDK cannot know the body when it presigns),
and current R2 ignores that query parameter rather than validating it against the
bytes that arrive. Upload 200, playback 501.

### Fix

`lib/r2/client.ts` pins both options to `WHEN_REQUIRED`:

```ts
requestChecksumCalculation: 'WHEN_REQUIRED',
responseChecksumValidation: 'WHEN_REQUIRED',
```

Presigned URLs now contain exactly the parameters Cloudflare documents
(`X-Amz-Algorithm/Credential/Date/Expires/SignedHeaders/Signature`, plus the
`response-content-*` overrides we ask for). Server-side calls that genuinely
require a checksum still get one.

## Root cause 2 — the profile gallery never resolved storage keys

`components/views/ProfileView.tsx` (`MediaGrid`) rendered stored references
directly:

```tsx
<img   src={p.image} … />
<video src={p.video} … />      // p.video === "posts/<uid>/2026-09/<uuid>.mp4"
```

A bare R2 key is not a URL. The browser resolved it against the app origin and
requested `https://ruhiz…/posts/<uid>/…/x.mp4` → 404 → broken tile, and the
lightbox got the same raw string. `components/views/SavedView.tsx` and
`app/profile/page.tsx` (`cover_url` / `avatar_url`) had the identical bug.

`PostCard` (the feed) did it correctly via `R2Video`; the profile did not.

### Fix

All four sites now go through the resolving components — `R2Image` / `R2Video` /
`useMediaUrl` — so a key is exchanged for a signed URL before it reaches a `src`.
The profile video grid also became clickable and opens the video in a lightbox
player instead of being a dead thumbnail.

## Hardening applied while in there

| Area | Change |
|---|---|
| MIME type | `/api/media` signs `response-content-type` derived from the key extension, so an object stored as `application/octet-stream` still reaches `<video>` as `video/mp4` and plays. |
| Caching | `/api/media` responses are `private, no-store` — one member's signed URL must never be served to another by a shared cache. |
| Player recovery | `R2Video`/`R2Image` distinguish *resolving* from *broken*, and re-sign once automatically when a URL expires mid-session or a request blips. `resolveMediaUrl(ref, { force: true })` backs this. |
| YouTube detection | Now runs on the stored reference only, never on a signed URL, so the 11-char video-id pattern can't false-positive. |
| Dead `blob:` URLs | `uploadMedia` used to swallow any R2 failure and return `URL.createObjectURL(file)`. That `blob:` URL was written to `posts.video_url` and reported as a success — then died with the page and showed "Video unavailable" forever, for everyone. A configured-but-failing backend now raises a friendly, retryable error; the session-local fallback remains only for genuine demo mode (and `data:` URLs, which are self-contained and safe to persist). |
| Error copy | `createPost` no longer interpolates the raw Postgres message into a user toast; it logs to console and shows actionable copy. |
| Upload limits | `CreatePostModal` now reads `UPLOAD_LIMITS` instead of its own hardcoded 50 MB / missing `video/x-m4v`, so the picker and `/api/upload/presign` cannot disagree. |
| Signed MIME type | `/api/upload/presign` commented that Content-Type was "signed: the browser must PUT with this exact type" — it was not. The SDK signed only `host`, so a holder of the URL could store *any* Content-Type at that key, which is exactly how unplayable MIME types end up on otherwise valid objects. It now passes `signableHeaders: new Set(['content-type'])` (producing the `content-type;host` form Cloudflare documents) and echoes the signed value back, and `lib/upload.ts` PUTs that exact string rather than `file.type` — so enforcement cannot be defeated by a casing difference. |

## Verification

`npm run test:media` — 51 assertions, all passing.

The sandbox cannot reach `*.r2.cloudflarestorage.com`, so the harness
(`scripts/test/`) boots:

* an **R2-faithful S3 mock** that really verifies SigV4 (both query-string
  presigned auth and header auth), reproduces R2's documented
  `x-amz-checksum-mode` → `501 NotImplemented`, and honours `Range` and
  `response-content-*` overrides, and
* a **minimal Supabase Auth mock**, so the repo's own route handlers run
  unmodified under a real `next dev`.

It then walks a brand-new 256 KB MP4 through the production path:

```
presign → PUT → /api/upload/complete → posts.video_url → /api/media → <video> fetch
```

Covered: no checksum params on either signed URL; object lands at the returned
key byte-identical with `Content-Type: video/mp4`; verification reports the
right size and type; the stored value is a key (not a `blob:` URL) and is
recognised by `isR2Key`; the signed media URL returns **206** with correct
`Content-Range`, `Accept-Ranges: bytes`, `video/mp4` and
`Content-Disposition: inline`; a tail seek and a full download both match the
uploaded bytes; a legacy `application/octet-stream` object is repaired to
`video/mp4`; path traversal, foreign keys and disallowed MIME types are
rejected; `Content-Type` is genuinely part of the PUT signature and a PUT that
lies about its media type is refused with 403; and a tampered signature is
refused with 403 (proving the mock's verification is real, not a rubber stamp).

Part A of the same script re-runs the old client config side by side, so the
`501 → 206` difference is visible in one output.

## ⚠️ Separate, urgent: leaked credentials

`VERCEL_ENV_VARS.md` contains **live R2 credentials in plaintext, committed to
the repo** (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
bucket `theruhiz`). They are in git history, so deleting the file is not enough:

1. Rotate the R2 API token in the Cloudflare dashboard.
2. Remove the real values from the doc (keep it as a template).
3. Scrub history if the repo is or ever becomes public.

Nothing in this fix depends on those values — the test harness uses its own
throwaway credentials.
