# RUHIZ — Feed Recommendation Algorithm & Support Role System
### Design specification (no implementation yet)

This document specifies two things that currently don't exist in a real form in the prototype:

1. A real recommendation algorithm behind the Home feed's five tabs (**For You, Latest, Trending, Nearby, Unsolved**), including how photo/video/thought posts get mixed.
2. A profile picture upload flow (currently there is no UI for this at all — `Edit Profile` only edits text fields).
3. A role & verification system for Emotional Support, distinguishing **peer listeners** from **trained volunteers** from **licensed professionals (psychologists/therapists)**.

Today the prototype fakes all of this with static arrays and a simple formula (see `src/app/page.tsx` → `applyFilter`, `trendScore`). This doc describes what should replace that once there's a real backend, and what should change in the data model (`src/lib/types.ts`) to support it.

---

## 1. Home Feed Recommendation Algorithm

### 1.1 Philosophy, restated as ranking rules

RUHIZ's stated goal is "move problems toward outcomes," not "maximize time on screen." That has to show up as actual ranking rules, not just copy on the page:

- **Discussion quality outranks raw popularity.** A post with 5 pieces of real evidence/experience should usually outrank a post with 500 passive "cares" and no discussion.
- **Unresolved problems should surface, not decay.** A normal engagement feed buries old posts. RUHIZ should keep surfacing open problems until they're solved or abandoned.
- **No infinite scroll bait.** Every tab should feel like it has a bottom (the prototype already does this with the "You're up to date" message) — ranking should optimize for "did this help something move forward," not "did this keep the session open."

### 1.2 Shared signals (used by multiple tabs)

| Signal | Source | Notes |
|---|---|---|
| `engagementVelocity` | supports, cares, shares, discussion count, each divided by hours-since-post | Raw counts reward old posts; velocity rewards *current* activity |
| `discussionDepth` | number of distinct contribution **types** present (experience/evidence/opinion/counter/question/solution) | A post with 3 types of contribution is healthier than one with 20 replies that are all "support" |
| `categoryAffinity(user, category)` | rolling score per user per category | See 1.3 |
| `authorAffinity(user, author)` | 1 if user supports author or author supports user, else social-distance decay | People you support should show up more |
| `geoDistance(user, post)` | real lat/long radius once available; today a boolean `nearby` tag | See 1.6 |
| `needsHelpScore` | inverse of `helpOffers.length`, scaled by `supports` (demand) | A popular problem with *no* help offers should be surfaced more urgently than one already well-staffed |
| `freshnessDecay(post)` | exponential or power-law decay by age | Different half-life per tab (Trending decays fast, Unsolved decays slowly) |
| `seenPenalty(user, post)` | down-rank (not hide) posts already shown 2+ times with no interaction | Prevents the same 5 posts dominating every session |

### 1.3 "For You" — personalized ranking

This is the only tab that should run a real per-user model. Composition:

```
score(post, user) =
    0.30 × categoryAffinity(user, post.category)
  + 0.20 × authorAffinity(user, post.author)
  + 0.15 × engagementVelocity(post)
  + 0.15 × discussionDepth(post)
  + 0.10 × needsHelpScore(post)          // only if post.intent == "problem"
  + 0.10 × recencyBoost(post)
  − 0.20 × seenPenalty(user, post)
```

**`categoryAffinity` build-up** (how we learn what someone cares about, without asking them to fill out a survey):

- +3 for each category of a post the user authored
- +2 for each category of a post the user Supported or Saved
- +1 for each category the user left a Discussion contribution on
- +2 for each category of a person the user Supports (i.e. "people like the people you follow")
- Decay the whole running total by ~5%/week so interests can shift over time

**Diversity constraint:** after scoring, do a re-rank pass that caps any single category at roughly 40% of the visible window (e.g. max 4 of the next 10 cards from one category), so "For You" doesn't collapse into a single-topic tunnel even for a user with one dominant interest.

**Cold start (new user, no history):** fall back to a popularity-weighted sample across categories, biased toward posts with high `discussionDepth` and problems with low `needsHelpScore` coverage — i.e., show healthy discussions and problems that genuinely need people, not just whatever is most liked.

### 1.4 "Latest" — intentionally unscored

Pure reverse-chronological by `createdAt`. No personalization, no boosting. This tab exists specifically so a power user can audit "what is actually new" without any algorithmic interference — it's the transparency valve. The only filtering applied is safety (hidden/reported posts excluded), never relevance.

### 1.5 "Trending" — velocity, not volume

Current prototype formula (`src/app/page.tsx`):

```
trendScore = (discussions × 4 + supports + shares × 2) / (ageHours + 2)^0.8
```

This is a reasonable v1 and should stay close to this shape. Refinements for a real backend:

- **Weight discussion highest** (already done ×4) because RUHIZ's core loop is discussion → solution, not passive approval. Keep that bias deliberately, don't "balance" it toward likes.
- **Replace flat `age + 2` with a half-life window per content type.** Thoughts and short posts trend and die within hours; problems with active debate should get a longer half-life (~36–48h) since real discussions take days to develop evidence and counterarguments.
- **Guard against brigading:** if more than ~70% of a post's supports/cares arrive from accounts created in the last 24h, or from a tight cluster of accounts that only interact with each other, discount the velocity score. (Not needed for the demo, but necessary before this is real.)
- **Solutions and problems should trend on separate sub-rankings** that get interleaved, so a trending Solution Card doesn't get crowded out purely because problem posts generate more raw comment volume.

### 1.6 "Nearby" — geography first, then the same velocity logic

Today `nearby` is a boolean flag set by the composer ("Tag my area"). The real version:

1. Resolve the user's location (opt-in city/area, not precise GPS by default — this matters for Identity Saver users who don't want to be geo-identified).
2. Filter posts to a radius (start at city-level, e.g. ~25km, expandable if too few results — "Pune" → "Pune district" → "Maharashtra" with a visible label showing which radius is active, so it's never a silent fallback).
3. Within that filtered set, apply the same `engagementVelocity + discussionDepth` ranking as Trending, not just recency — a nearby problem with active discussion should outrank one that was posted five minutes ago and has nothing on it.
4. Always slightly over-weight **problems** over thoughts/experiences in this tab specifically — "Nearby" is where local, actionable issues should be easiest to find, since that's where the user is actually positioned to help in person.

### 1.7 "Unsolved" — urgency ranking, not recency ranking

This is the tab that most needs to *not* behave like a normal feed. Filter: `intent == "problem" AND status != "solved"`. Then rank by an urgency score instead of newest-first:

```
urgency(post) =
    0.35 × (1 − helpCoverage(post))      // helpCoverage = min(1, helpOffers.length / 3)
  + 0.25 × supports(post)  [normalized]  // demonstrated demand/importance
  + 0.20 × daysOpenWithoutProgress(post) // stuck problems should resurface, not disappear
  + 0.20 × discussionDepth(post)
```

- `daysOpenWithoutProgress` specifically means: time since the *last* status/lifecycle update, not time since creation. A problem that just moved into "Solutions Proposed" yesterday shouldn't rank above one that's been stuck in "Unsolved" for three weeks with zero movement.
- A problem that already has 3+ help offers and an active Solution Card should drop in this ranking even if it's popular — the tab's job is to surface what's being *neglected*, not what's already loudest. This is the one place where high engagement should lower rank, deliberately inverted from every other tab.

### 1.8 Mixing content types (photo / video / thought)

Independent of which tab is active, apply a light interleaving pass so the feed doesn't accidentally become "12 videos in a row" or "nothing but text":

- Compute the ranked list per-tab as above.
- Walk the list and if the same `kind` has appeared 3× consecutively, pull the next-best post of a different kind up from further down the list (swap, don't drop).
- Videos additionally get a **completion-rate** signal once real playback exists (today there's no real video backend, so this is simulated): `watchedSeconds / duration` averaged across viewers. A video with high replays/completion should rank similarly to a post with high discussion depth, since it indicates the content is actually useful, not just clicked.

### 1.9 What this needs from a backend (not in prototype today)

- Per-user interaction history (what they've supported/saved/commented, with timestamps) — currently all local `useState`, resets on refresh.
- Server-side aggregation of `engagementVelocity` so it isn't recomputed from scratch per request.
- Geo resolution service (even coarse, city-level) for Nearby.
- A `lastStatusChangeAt` field on `Post` (today `updates[].at` exists but isn't indexed/queried for ranking — see `LifecycleUpdate` in `src/lib/types.ts`).

---

## 2. Profile Picture Upload — missing UX

Confirmed gap: `Edit Profile` (`src/components/shell/CommonModals.tsx` → `EditProfileModal`) only edits `headline`, `bio`, `location`, `expertise`, `canHelpWith`, and `identity`. There is no avatar field, no upload control, and `Avatar.tsx` only ever reads `user.avatar` (a static URL) with a text-initials fallback if the image fails to load. This section specifies the flow to add.

### 2.1 Entry points

- **Edit Profile modal:** add a photo control at the very top, above the Headline field — tapping/clicking the current avatar (or a camera-badge overlay on it) opens the upload flow. This is the primary entry point.
- **Own profile page:** hovering/tapping the avatar in the profile header shows the same camera-badge overlay directly, as a shortcut that skips straight into upload without opening the full Edit Profile modal.
- **Settings → Account:** the existing avatar + "Edit profile" row gets the same camera-badge affordance.

All three entry points open the identical upload flow described below — there should only be one implementation of this, not three different ones.

### 2.2 Flow

1. **Source picker** (small action sheet / popover, not a full modal yet):
   - Upload a photo (opens native file picker; on mobile, this also exposes "Take Photo" via the OS camera capture attribute)
   - Choose from avatar presets (a small curated set of neutral illustrated avatars — important for **Identity Saver** users who don't want to upload a real photo at all, see 2.4)
   - Remove current photo (reverts to the initials fallback already built into `Avatar.tsx`)
2. **Crop & position** (only when a real photo is chosen): a fixed 1:1 circular-mask cropper with pinch/drag-to-zoom and drag-to-reposition. No freeform aspect ratio — every avatar in the app renders as a circle (or rounded-square for organizations, per the existing `kind === "organization"` branch in `Avatar.tsx`), so the crop tool should show that exact mask live, not a generic square crop the user has to guess about.
3. **Preview**: show the cropped result at the three sizes it will actually appear at in the app — header avatar (sm), profile page hero (3xl), and a feed post avatar (lg) — side by side, so the user can catch "looks fine big, unreadable small" problems before saving.
4. **Confirm / Save**: optimistic update — the new avatar shows immediately everywhere in the current session while any upload/processing happens in the background; roll back with a toast ("Couldn't update your photo, please try again") if it fails.

### 2.3 States & constraints

- **File constraints:** JPG/PNG/WEBP, max ~8MB client-side before upload, client-side downscale to a sane max resolution (e.g. 1024×1024) before sending, to keep this cheap once there's a real backend.
- **Loading state:** while an uploaded/cropped image is processing, show the *current* avatar with a subtle spinner overlay rather than blanking it out — never show an empty/broken avatar mid-update.
- **Failure state:** invalid file type/size shows an inline error in the source picker, not a generic toast, so the user immediately understands what to fix.
- **Empty state (no photo at all):** this already exists and should stay — `Avatar.tsx`'s current two-letter-code gradient fallback is the right default and should remain the permanent fallback for any user who never sets a photo, not just a loading placeholder.

### 2.4 Interaction with Identity Saver / Identity Revealer

This is the one place profile-picture upload needs RUHIZ-specific behavior, not generic social-app behavior:

- If the user's identity mode is **Identity Saver**, uploading a real personal photo should show a one-time, dismissible notice: *"You're in Identity Saver mode. A real photo may make you recognizable. Consider one of the avatar presets instead."* — not a hard block, just a clear nudge, since the choice should stay with the user.
- The avatar preset set should be offered first/prominently for Saver-mode users, and the "Upload a photo" option simply listed alongside it rather than hidden — RUHIZ shouldn't make privacy-by-default feel like a punishment or a dead end.
- Switching from Revealer → Saver later (in Settings) should prompt "Switch to an avatar preset too?" as an optional one-click action, not automatic — don't silently strip someone's photo.

### 2.5 Accessibility

- The camera-badge overlay needs a real `aria-label` ("Change profile picture"), not just an icon.
- Crop tool must be operable via keyboard (arrow keys to nudge position, +/- to zoom) for users who can't drag precisely, in addition to pointer/touch drag.
- Preset avatars need distinct, meaningful `alt` text (not "avatar 1", "avatar 2") so screen-reader users can actually tell them apart when choosing.

### 2.6 Data model additions needed

`User` (`src/lib/types.ts`) already has `avatar: string`. To support this flow properly, add:

- `avatarSource: "upload" | "preset" | "default"` — lets the UI decide whether to show the Identity Saver nudge on next edit, and lets Settings show "Remove photo" only when it's meaningfully different from the default.
- `avatarUpdatedAt?: number` — for cache-busting the image URL after a change.

No changes needed to `Avatar.tsx`'s rendering logic itself — it already handles org vs. person shape and the fallback correctly; it just needs an upload flow feeding `user.avatar` instead of that field being permanently static.

---

## 3. Emotional Support — Role & Verification System

Today `SupportProfile` (`src/lib/types.ts`) has `type: "peer" | "professional"` and an optional free-text `credential` string with **no verification at all** — anyone could claim "Licensed Psychologist" in that field (see the demo seed in `src/data/social.ts`, e.g. `#U6P1Z4`'s `credential: "RCI-registered counselling psychologist (demo verification)"` — note it's literally labeled as fake). This section specifies the real system that should replace that free-text field.

### 3.1 Role tiers

Four distinct tiers, each with different UI treatment and different trust implications. This replaces the current two-value `type` field.

| Tier | Who | Verification required | Badge shown |
|---|---|---|---|
| **Peer Supporter** | Any user who opts in via Settings → Emotional Support (already exists in the prototype as `settings.supportVolunteer`) | None — self-declared "areas I'm comfortable supporting" | "Community peer supporter" (sky badge, already exists) |
| **Trained Listener** | A peer supporter who has completed RUHIZ's own short training module (crisis-awareness basics, when to escalate, what not to promise) | Completion of an in-app training flow, no external credential | A distinct badge, e.g. "RUHIZ-trained listener" |
| **Licensed Professional** | Psychologists, therapists, licensed counsellors | Full credential verification (3.2) | "Verified professional" (amber badge, already exists visually — currently unverified in logic) |
| **Organization** | NGOs/clinics offering support services (already exists as `User.kind === "organization"`) | Organization registration verification (lighter than individual licensing — business registration + a named responsible contact) | "Verified organization" |

This is a strict upgrade path: Peer → Trained Listener is self-serve inside the app; → Licensed Professional always requires the human review process below, regardless of prior tier.

### 3.2 Verification workflow (Licensed Professional)

1. **Application:** user selects "Apply as a licensed professional" from Settings → Emotional Support. Form collects: credential type (Psychologist / Therapist / Counsellor / Psychiatrist / Social Worker, etc.), licensing body / registration number (e.g. RCI registration in India), issuing country/region, and an upload of the license/certification document.
2. **Pending state:** profile immediately shows as **"Verification pending"** (a neutral, non-badge state — never show the professional badge before approval, and never silently fall back to showing them as an unverified peer either; pending is its own visible state so the user knows where they stand).
3. **Review:** goes into a moderation queue for a human reviewer (RUHIZ trust & safety team) to check the registration number against the issuing body's public registry where one exists, and sanity-check the document. This is explicitly **not** automatable with confidence for medical/psychological licensing — don't build an auto-approve path.
4. **Outcome:**
   - *Approved* → badge activates, `verifiedAt` timestamp set, `expiresAt` set to a re-verification date (e.g. 12 months, or the license's own expiry if known).
   - *Rejected* → profile reverts to Peer Supporter tier (not deleted), with a private reason shown only to the applicant, and a cooldown before re-applying.
5. **Re-verification:** on `expiresAt`, badge is automatically suspended (not removed from history) until the user re-submits. Suspension should produce a clear, non-shaming notice to the user and quietly degrade their public badge rather than exposing a "LAPSED" label.
6. **Revocation:** trust & safety can revoke at any time (e.g. a credential turns out to be fraudulent) — this should log a reason internally and immediately strip the badge, independent of the expiry cycle.

### 3.3 Data model additions

Extend `SupportProfile` (`src/lib/types.ts`) roughly like this (shape only, not implementing it):

- `role: "peer" | "trained_listener" | "licensed_professional" | "organization"` — replaces the current `type: "peer" | "professional"`.
- `verification: { status: "none" | "pending" | "verified" | "rejected" | "expired" | "revoked"; credentialType?: string; issuingBody?: string; registrationNumber?: string; verifiedAt?: number; expiresAt?: number; reviewedBy?: string }`
- Keep `credential?: string` only as a **display label** derived from the verified fields (e.g. "RCI-registered Counselling Psychologist") — it should never again be free text the user controls directly; it's generated from `verification` once approved.

### 3.4 UI treatment differences

- **Peer / Trained Listener cards** stay visually warm and community-styled — avatar, code, areas, availability — matching the current `EmotionalSupportCard` design. Trained Listener gets a small additional badge, not a redesign.
- **Licensed Professional cards** get the amber "Verified professional" badge (already exists) **plus** a visible credential line (e.g. "RCI-registered Counselling Psychologist") sourced from `verification`, not from free text.
- **Pending-verification profiles** should not appear in public search/browse results at all until approved — "pending" is an internal-only state, not a public one.
- The existing crisis-line disclaimer (`CrisisNote` component, already implemented) stays visible on **every** tier's profile modal, including licensed professionals — RUHIZ peer/professional support is explicitly framed as not a substitute for emergency services, and that framing shouldn't soften just because someone is verified.

### 3.5 Safety-aware matching (how role should affect ranking, not just display)

- Default sort in the Emotional Support directory should **not** simply put professionals above peers — most people reaching out want a peer, not a clinician, and over-prioritizing "verified" tiers risks making the feature feel clinical and intimidating, against the product's own stated intent.
- However, if a request/post contains language suggesting acute risk (self-harm, crisis-level distress — this would need a lightweight, conservative keyword/heuristic check, reviewed by humans, not a confident ML classifier), the matching flow should **proactively surface the crisis line first**, and bias toward Licensed Professionals / Organizations in the "who's available" suggestions, in addition to — not instead of — the always-visible crisis disclaimer.
- Language and availability filters (already in the current `/support` page) stay role-agnostic — a user filtering by "Exam stress" + "Available now" should see peers and professionals mixed, sorted by availability, with role shown as a badge, not as the primary sort key.

### 3.6 Trust & moderation lifecycle summary

```
peer (self-declared)
   ↓ completes in-app training
trained_listener
   ↓ submits license/credential application
pending verification  →  rejected (reverts to prior tier, cooldown)
   ↓ approved by human reviewer
licensed_professional (badge active, expiresAt set)
   ↓ time passes
expiresAt reached → badge suspended → re-submit → back to "pending"
   ↓ (at any point, independent of expiry)
trust & safety revokes → badge stripped immediately, logged
```

Nothing here is implemented yet — this is the spec to build against once there's a real backend and a moderation surface for the trust & safety review step.
