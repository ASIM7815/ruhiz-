# RUHIZ — Privacy, post management, video upload & Explore (user requirements)

Source: user request, 2026-10-14. This is the authoritative spec. Sections 1–13 below are the user's requirements, lightly condensed; nothing was dropped.

## Ground rules from the user
- Audit the existing codebase first (architecture, DB schema, auth, storage, UI). Preserve architecture, design system and DB wherever possible. Smallest complete set of changes.
- Do not rebuild the app, remove working features, or replace the deterministic recommendation algorithm with AI.
- Fix real underlying logic (server + data layer), not just the frontend. No mock functionality, hardcoded success states, or frontend-only security.
- Never report a test as passed unless it was actually executed.

## 1. Automatic identity hiding (default privacy)
- Identity is hidden by default for every authenticated user, on every login/refresh/new session/device.
- While hidden, never expose real name, profile description, or other identifying details to other users — not via post metadata, API responses, DB queries, HTML attributes, network requests, or frontend state.
- Show a neutral anonymous label + avatar.
- Applies across feed, Explore, profiles, comments, search, notifications, post details.
- Enforce on the server / data-access layer, not with CSS or conditional rendering. Store identity status securely; validate every identity-related action server-side.

## 2. Identity reveal — explicit consent + required details
- "Reveal Identity" opens a form for the required identity details.
- Validate on frontend AND backend; reject empty / whitespace-only / invalid values.
- No reveal until all required details are submitted successfully.
- Clear explanation that identity/profile info becomes visible to others; explicit confirmation before publishing.
- Save securely; update identity status only after server-side validation succeeds.
- Loading state, success message, useful errors.
- Revealed: show permitted profile info (name, description) using the existing profile design.
- Hidden: private details inaccessible to others, including via direct API requests.
- Provide a working way back to anonymous mode (if consistent with product privacy rules). Re-hiding must remove public access without leaving sensitive data in cached responses.

## 3. Identity visibility when viewing posts
- Anonymous author: only anonymous label/avatar + public content; at most a non-sensitive public identifier. Clicking avatar/name/identifier must not bypass privacy. Block access via profile routes, APIs, search, comments, network responses.
- Revealed author: show permitted public identity info; profile opens with intentionally public info.
- Never confuse internal DB user ID with a public identifier; never expose auth tokens, emails, internal security metadata, or private DB ids.
- Decide whether visibility is account-wide or post-specific per the EXISTING product model; keep it consistent everywhere and never expose old anonymous posts through a new component.

## 4. Post options — delete, edit, actions
- Delete option is currently missing. Audit/fix post action menus everywhere.
- Owner sees: Delete, Edit (if editing is supported), and other existing actions — on desktop and mobile.
- Confirmation dialog before delete. Delete or soft-delete per existing data model.
- Remove the post from feed and Explore without full reload; on server rejection, restore UI gracefully.
- Safe cleanup of associated media and dependent records.
- Ordinary users can never delete others' posts; ownership enforced on the backend.
- Audit all other post action buttons to confirm they do what they say.

## 5. Remove "Problem Solved" profile option
- Remove its profile tab/button/section, related nav links and empty states; check references elsewhere.
- Do not delete unrelated problem categories, post records, or recommendation data. Only remove backend/DB functionality if genuinely unused and safe to migrate.

## 6. Profile background banner
- Responsive banner, ~3:1 on desktop (suggested 1500×500), object-fit: cover with sensible positioning; responsive on mobile preserving the important area.
- Avatar and profile controls remain readable over it. Fallback when no banner exists.
- If banner uploads are supported: validate type and size, secure storage policies. Banner must not be required for existing users.
- No layout overflow / overlap on small screens.

## 7. Fix video uploads and CORS
- Video upload currently fails, "reportedly" due to CORS. Diagnose the real cause first: console errors, network requests/status codes, preflight + response headers, auth and storage authorization, the storage provider in use, upload URL generation/signed URLs/expiry, file validation, request size limits, DB inserts, playback URLs, frontend handlers and backend endpoints.
- Fix for the actual storage architecture. CORS only for required prod + dev origins; only necessary methods/headers; handle OPTIONS preflight; never wildcard origin with credentials.
- Do not disable auth, storage security, RLS, or authorization as a workaround.
- Uploaded videos must be playable by authorized users.
- Resumable or multipart uploads where supported. Upload progress, success, retry, actionable errors; UI usable during large uploads.
- Don't assume every failure is CORS — also check auth, storage policies, network, size limits, MIME types.

## 8. Video limit — 1 GB per video
- Consistent across client, server, storage provider (and reverse proxy if any).
- Accept up to 1 GB; reject larger with a clear error. Validate the actual size, not filename/client metadata.
- Direct-to-storage / resumable / multipart instead of routing large files through a size-limited server endpoint.
- Auth, per-user upload authorization, quotas, rate limits. Allowed video formats/MIME types validated.
- Handle interrupted uploads and retries safely; clean up abandoned multipart uploads and failed temp files.
- If the provider/plan cannot support 1 GB, identify the exact limitation and give the compatible implementation or required configuration. Do not claim 1 GB support until a real upload has been verified.

## 9. Explore — category filtering + randomized discovery
- Remove default sections: Trending Problems, Recent Problems, Popular Solutions.
- Content-type filters: All, Videos, Photos, Thoughts (map Thoughts to the existing text post type; no duplicate content types).
- Selecting any existing problem category: fetch that category's posts, apply content-type filter, show results, exclude deleted/unavailable/unauthorized content, respect identity privacy + visibility rules, empty state when none, update on category/type change.
- Flow: Category → Content type → randomized matching posts (e.g. Education + Videos = randomized Education videos).
- Randomize order within the eligible set; avoid identical results on every refresh where practical; pagination without duplicates; keep category matching; apply existing moderation, blocked-user, visibility, safety rules.
- Efficient DB-side randomization — no fetching the whole table to the browser, no expensive unbounded random sort.
- Responsive on mobile and desktop.

## 10. Privileged post deletion for two admins
- Accounts: mohammadasimsaad@gmail.com and owaisarif555@gmail.com (first one is the intended gmail.com address; the user's original text had a typo). Verify each corresponds to the correct existing account before assigning.
- Explicit privileged role/permission via a trusted server-side process or protected migration. Never grant admin because a client submits an email; never rely on frontend email comparisons.
- Role assignments protected from ordinary users; enforce in backend and all applicable DB/storage policies.
- Only these two get cross-user post deletion unless additional admins already exist in the established role system.
- Admins see the delete option on others' posts.
- Audit log clearly distinguishes admin deletion from owner deletion.
- Admins must NOT gain unrelated access (private messages, passwords, tokens, hidden identity details) unless separately authorized.
- Preserve existing role-based permissions. No service-role/secret keys in the browser.

## 11. Audit other policies affecting UX
Auth/session handling; identity privacy & profile visibility; DB access policies (RLS if present); storage bucket policies & CORS; image/video limits; MIME validation; deleted-post visibility; Explore filters & pagination; ownership & admin permissions; profile editing & reveal validation; media playback; mobile responsiveness; error/loading states; rate limiting & quotas; cache invalidation & stale private data; security headers & production env config. Fix policies that wrongly block legitimate actions without weakening security.

## 12. Testing / acceptance (execute for real; never claim unexecuted passes)
- Identity: new user signs up/logs in; hidden by default; anonymous post leaks nothing private in API responses; reveal fails with missing details; reveal succeeds only with valid details + explicit confirmation; revealed identity correct across posts/profiles; hidden identity stays protected after refresh and across sessions.
- Posts: own delete works; deleting another user's post fails; both admins can delete others' posts; unauthenticated/unauthorized cannot bypass backend; deleted posts vanish from Explore and feeds.
- Media: image upload + display; video upload + playback; progress and error states; a video within 1 GB supported by the configured architecture; oversized rejected; CORS, auth and storage authorization tested independently.
- Explore: every category returns matching content; All/Videos/Photos/Thoughts work; randomized within eligible set; pagination without unnecessary duplicates; empty states; anonymous authors stay anonymous.
- Regression/security: banner OK desktop + mobile; Problem Solved removed; existing auth + features still work; access-control tests pass; production build and typecheck pass.
- Automated tests where practical; browser-based tests for real workflows.

## 13. Final delivery report
1. Root causes. 2. Files/components modified. 3. DB migrations and policies changed. 4. Identity privacy + admin authorization implementation. 5. Video upload/CORS fixes and actual supported size limit. 6. Explore filtering + randomization implementation. 7. Tests actually executed and results. 8. Remaining env config, provider limitations, deployment steps.
