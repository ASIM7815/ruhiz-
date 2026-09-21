'use client';

/**
 * DUEL local adapter — a complete in-browser implementation of the DUEL
 * data contract, persisted to localStorage. It is used whenever Supabase
 * environment variables are absent (preview / offline / first-run), and it
 * implements the same rules as the SQL migration: streaks, completion detection,
 * proof media tracking, performance calculations, and activity logging.
 *
 * All fake/demo personas, starter challenges, fake follower counts, and
 * placeholder posts are completely removed. Only real authenticated user
 * data is stored and displayed.
 */

import type { ActivityAction, AppNotification, Thread, UserProfile } from '@/lib/types';
import { uid } from '@/lib/format';
import { defaultSettings, emptyDB, type DuelDB } from './db';
import { isoDay, SEED_CATEGORIES } from './seed';
import type { Challenge, ChallengeComment, ChallengePost, ChallengePostMedia, Checkin, CreateChallengeInput, FeedPost, Participation, PostComment, SubmitPostInput } from './types';
import { durationBucket } from './types';
import type { DuelAdapter, FeedQuery } from './adapter';
import { buildUserKeywords, creatorAffinity, keywordOverlap } from './keywords';
import { computeAffinity } from './recommend';

/** ISO day (yyyy-mm-dd) for a timestamp — day-slot date maths. */
function isoDayFrom(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const STORAGE_KEY = 'duel.db.v2';

async function hashPassword(pw: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`duel::${pw}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `plain::${pw}`;
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export class LocalAdapter implements DuelAdapter {
  readonly kind = 'local' as const;
  private db: DuelDB = emptyDB();
  private listeners = new Set<(db: DuelDB) => void>();
  private saveQueued = false;
  private timers: number[] = [];
  private viewedThisSession = new Set<string>();

  subscribe(cb: (db: DuelDB) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit() {
    if (!this.saveQueued) {
      this.saveQueued = true;
      queueMicrotask(() => {
        this.saveQueued = false;
        this.persist();
      });
    }
    const snap = clone(this.db);
    this.listeners.forEach((l) => l(snap));
  }

  private persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    } catch {
      /* storage full / private mode — keep running in memory */
    }
  }

  /* ------------------------------ bootstrap ----------------------------- */

  async bootstrap(): Promise<{ db: DuelDB; authed: boolean; error?: string }> {
    let loaded: DuelDB | null = null;
    try {
      // Clean up legacy v1 key if present to purge old demo personas
      if (window.localStorage.getItem('duel.db.v1')) {
        try {
          const old = JSON.parse(window.localStorage.getItem('duel.db.v1') || '{}');
          if (old && old.accounts && old.accounts.length) {
            // Keep real created accounts if any
            loaded = old;
          }
        } catch {
          // ignore
        }
        window.localStorage.removeItem('duel.db.v1');
      }

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DuelDB;
        if (parsed) loaded = parsed;
      }
    } catch {
      loaded = null;
    }

    this.db = loaded ?? this.seed();
    this.migrateShape(this.db);
    this.dailyStreakReminders();
    this.emit();
    return { db: clone(this.db), authed: Boolean(this.db.meId) };
  }

  private seed(): DuelDB {
    const db = emptyDB();
    db.v = 2;
    db.categories = clone(SEED_CATEGORIES);
    db.challenges = [];
    db.profiles = {};
    db.participants = [];
    db.posts = [];
    db.postMedia = [];
    db.checkins = [];
    db.comments = [];
    db.settings = defaultSettings();
    return db;
  }

  /** Tolerate older persisted shapes and purge any legacy fake personas/challenges. */
  private migrateShape(db: DuelDB) {
    db.v = 2;
    db.settings = { ...defaultSettings(), ...db.settings };
    db.accounts ??= [];
    db.threads ??= [];
    db.searches ??= [];
    db.activities ??= [];
    db.posts ??= [];
    db.postMedia ??= [];
    db.categories = clone(SEED_CATEGORIES);

    // Purge legacy personas and their starter challenges
    if (db.profiles) {
      for (const [id, p] of Object.entries(db.profiles)) {
        if (p.persona || id.startsWith('u-aya') || id.startsWith('u-marcus') || id.startsWith('u-lina') || id.startsWith('u-kenji') || id.startsWith('u-priya') || id.startsWith('u-diego') || id.startsWith('u-sara') || id.startsWith('u-tomas')) {
          delete db.profiles[id];
        }
      }
    }

    db.challenges = (db.challenges || []).filter(
      (c) =>
        !c.id.startsWith('c-coding-30') &&
        !c.id.startsWith('c-fitness-21') &&
        !c.id.startsWith('c-detox-7') &&
        !c.id.startsWith('c-reading-30') &&
        !c.id.startsWith('c-mind-14') &&
        !c.id.startsWith('c-leetcode-45') &&
        !c.id.startsWith('c-sleep-7') &&
        !c.id.startsWith('c-nosugar-30') &&
        !c.id.startsWith('c-journal-14') &&
        !c.id.startsWith('c-budget-21') &&
        !c.id.startsWith('c-draw-30') &&
        !c.id.startsWith('c-steps-7') &&
        !c.id.startsWith('c-water-30') &&
        !c.id.startsWith('c-ship-14') &&
        !c.id.startsWith('c-spanish-30') &&
        !c.id.startsWith('c-outside-7') &&
        !c.id.startsWith('c-marathon-90') &&
        !c.id.startsWith('c-deepwork-14')
    );
    db.checkins = (db.checkins || []).filter((c) => !c.id.startsWith('ck-seed-'));
    db.comments = (db.comments || []).filter((c) => !c.id.startsWith('cm-'));
    db.participants = (db.participants || []).filter(
      (p) =>
        !p.userId.startsWith('u-aya') &&
        !p.userId.startsWith('u-marcus') &&
        !p.userId.startsWith('u-lina') &&
        !p.userId.startsWith('u-kenji') &&
        !p.userId.startsWith('u-priya') &&
        !p.userId.startsWith('u-diego') &&
        !p.userId.startsWith('u-sara') &&
        !p.userId.startsWith('u-tomas')
    );
  }

  /* -------------------------------- auth -------------------------------- */

  async demoSignUp(input: { email: string; password: string; name: string; username: string }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    if (this.db.accounts.some((a) => a.email === email)) throw new Error('An account with this email already exists.');
    let username = input.username.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
    if (username.length < 3) username = `duelist${Math.floor(Math.random() * 900 + 100)}`;
    let candidate = username;
    let n = 1;
    while (Object.values(this.db.profiles).some((p) => p.username.toLowerCase() === candidate.toLowerCase())) {
      candidate = `${username.slice(0, 16)}${n++}`;
    }
    const profile: UserProfile = {
      id: uid('u-'),
      username: candidate,
      name: input.name.trim() || candidate,
      avatar: null,
      avatarHue: Math.floor(Math.random() * 360),
      cover: null,
      bio: '',
      location: '',
      website: '',
      joined: new Date().toISOString(),
      verified: false,
      persona: false,
    };
    this.db.profiles[profile.id] = profile;
    this.db.accounts.push({ email, password: await hashPassword(input.password), profileId: profile.id });
    this.db.meId = profile.id;
    this.notify(profile.id, { kind: 'system', text: 'Welcome to DUEL — create or join a challenge to start your daily streak.' });
    this.emit();
  }

  async demoLogin(email: string, password: string): Promise<void> {
    const account = this.db.accounts.find((a) => a.email === email.trim().toLowerCase());
    if (!account) throw new Error('No account found for this email.');
    const hash = await hashPassword(password);
    if (account.password !== hash) throw new Error('Incorrect password. Try again.');
    this.db.meId = account.profileId;
    this.emit();
  }

  async demoLogout(): Promise<void> {
    this.db.meId = null;
    this.viewedThisSession.clear();
    this.emit();
  }

  async demoResetPassword(email: string, newPassword: string): Promise<void> {
    const account = this.db.accounts.find((a) => a.email === email.trim().toLowerCase());
    if (!account) throw new Error('No account found for this email.');
    if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    account.password = await hashPassword(newPassword);
    this.emit();
  }

  get meId(): string | null {
    return this.db.meId;
  }

  /* ----------------------------- challenges ----------------------------- */

  async createChallenge(input: CreateChallengeInput): Promise<Challenge> {
    const me = this.requireMe();
    const ch: Challenge = {
      id: uid('c-'),
      creatorId: me,
      title: input.title.trim(),
      description: input.description.trim(),
      categoryId: input.categoryId,
      durationDays: input.durationDays,
      difficulty: input.difficulty,
      dailyTask: input.dailyTask.trim(),
      coverUrl: input.coverUrl,
      tags: input.tags,
      status: 'open',
      participantCount: 1, // creator automatically joins
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      viewCount: 0,
      completionCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.db.challenges.unshift(ch);
    this.db.participants.push({
      challengeId: ch.id,
      userId: me,
      status: 'active',
      joinedAt: ch.createdAt,
      currentStreak: 0,
      longestStreak: 0,
      completedDays: 0,
      lastCheckinDate: null,
      completedAt: null,
    });
    this.track('create', ch);
    this.emit();
    return clone(ch);
  }

  async updateChallenge(id: string, patch: Partial<Challenge>): Promise<void> {
    const me = this.requireMe();
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch) throw new Error('Challenge not found.');
    if (ch.creatorId !== me) throw new Error('You can only edit your own challenges.');
    Object.assign(ch, patch, { id: ch.id, creatorId: ch.creatorId });
    this.emit();
  }

  async deleteChallenge(id: string): Promise<void> {
    const me = this.requireMe();
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch) throw new Error('Challenge not found.');
    if (ch.creatorId !== me) throw new Error('You can only delete your own challenges.');
    this.db.challenges = this.db.challenges.filter((c) => c.id !== id);
    this.db.participants = this.db.participants.filter((p) => p.challengeId !== id);
    const removedPosts = new Set(this.db.posts.filter((p) => p.challengeId === id).map((p) => p.id));
    this.db.posts = this.db.posts.filter((p) => p.challengeId !== id);
    this.db.postMedia = this.db.postMedia.filter((m) => !removedPosts.has(m.postId ?? ''));
    this.db.checkins = this.db.checkins.filter((p) => p.challengeId !== id);
    this.db.comments = this.db.comments.filter((p) => p.challengeId !== id);
    this.db.likes = this.db.likes.filter((p) => p.challengeId !== id);
    this.db.saves = this.db.saves.filter((p) => p.challengeId !== id);
    this.db.shares = this.db.shares.filter((p) => p.challengeId !== id);
    this.emit();
  }

  async joinChallenge(id: string): Promise<void> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    if (this.db.participants.some((p) => p.challengeId === id && p.userId === me)) {
      throw new Error('You already joined this challenge.');
    }
    const now = new Date().toISOString();
    this.db.participants.push({
      challengeId: id,
      userId: me,
      status: 'active',
      joinedAt: now,
      currentStreak: 0,
      longestStreak: 0,
      completedDays: 0,
      lastCheckinDate: null,
      completedAt: null,
    });
    ch.participantCount += 1;
    this.track('join', ch);
    if (ch.creatorId !== me) {
      const myProfile = this.db.profiles[me];
      this.notify(ch.creatorId, {
        kind: 'join',
        actorId: me,
        challengeId: ch.id,
        text: `${myProfile?.name ?? 'A new challenger'} joined your challenge ${ch.title}`,
      });
    }
    this.emit();
  }

  async leaveChallenge(id: string): Promise<void> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const part = this.db.participants.find((p) => p.challengeId === id && p.userId === me);
    if (!part) throw new Error('You are not participating in this challenge.');
    if (part.status === 'completed') throw new Error('Completed challenges stay on your record.');
    this.db.participants = this.db.participants.filter((p) => !(p.challengeId === id && p.userId === me));
    ch.participantCount = Math.max(0, ch.participantCount - 1);
    this.track('leave', ch);
    this.emit();
  }

  /* --------------------- daily posts (the write path) --------------------- */

  /**
   * Submit (create or edit) a daily post — description + photo/video media.
   * The check-in ledger and participation streaks are derived from posts,
   * mirroring the SQL engine (day-slot model).
   */
  async submitDailyPost(
    input: SubmitPostInput
  ): Promise<{ post: FeedPost; participation: Participation | null }> {
    const me = this.requireMe();
    const ch = this.findChallenge(input.challengeId);
    let part = this.db.participants.find((p) => p.challengeId === input.challengeId && p.userId === me);

    if (!part) {
      if (ch.creatorId === me) {
        part = {
          challengeId: input.challengeId,
          userId: me,
          status: 'active',
          joinedAt: new Date().toISOString(),
          currentStreak: 0,
          longestStreak: 0,
          completedDays: 0,
          lastCheckinDate: null,
          completedAt: null,
        };
        this.db.participants.push(part);
      } else {
        throw new Error('Join the challenge before posting.');
      }
    }

    const day = input.dayNumber;
    if (!Number.isFinite(day) || day < 1 || day > ch.durationDays) {
      throw new Error(`Day ${day} is outside the challenge duration of ${ch.durationDays} days.`);
    }

    // Day-slot target date: joined date + (day - 1); never in the future.
    const joinedDate = part.joinedAt.slice(0, 10);
    const target = isoDayFrom(new Date(joinedDate + 'T00:00:00Z').getTime() + (day - 1) * 86400_000);
    if (target > isoDay(0)) throw new Error(`Day ${day} has not started yet.`);

    const caption = (input.caption ?? '').trim().slice(0, 2000);
    const mediaInput = input.media;
    if (!caption && (!mediaInput || mediaInput.length === 0)) {
      const existing = this.db.posts.find((p) => p.challengeId === ch.id && p.userId === me && p.dayNumber === day);
      if (!existing) throw new Error('A daily post needs a caption or media.');
    }

    let post = this.db.posts.find((p) => p.challengeId === ch.id && p.userId === me && p.dayNumber === day);
    const now = new Date().toISOString();
    if (post) {
      post.caption = caption;
      post.updatedAt = now;
    } else {
      post = {
        id: uid('p-'),
        challengeId: ch.id,
        userId: me,
        dayNumber: day,
        postDate: target,
        caption,
        likeCount: 0,
        commentCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.db.posts.push(post);
    }

    if (mediaInput) {
      // replace the media set for this post
      this.db.postMedia = this.db.postMedia.filter((m) => m.postId !== post!.id);
      mediaInput.forEach((m, i) => {
        this.db.postMedia.push({
          id: uid('pm-'),
          postId: post!.id,
          mediaType: m.type,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl ?? null,
          width: m.width ?? null,
          height: m.height ?? null,
          durationMs: m.durationMs ?? null,
          fileSize: m.fileSize ?? null,
          sortOrder: i,
          createdAt: now,
        });
      });
    }

    this.syncLedger(post);
    const participation = this.recomputeParticipation(ch, part);
    this.track('checkin', ch);
    this.emit();
    return {
      post: this.mapPostToFeed(post),
      participation: participation ? { ...participation } : null,
    };
  }

  /** Delete one of the caller's own daily posts. */
  async deletePost(postId: string): Promise<void> {
    const me = this.requireMe();
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('Post not found.');
    if (post.userId !== me) throw new Error('You can only delete your own posts.');
    const media = this.mediaOfPost(post.id);
    this.db.postMedia = this.db.postMedia.filter((m) => !media.includes(m));
    this.db.posts = this.db.posts.filter((p) => p.id !== postId);
    this.db.postLikes = this.db.postLikes.filter((l) => l.postId !== postId);
    this.db.postComments = this.db.postComments.filter((c) => c.checkinId !== postId);
    this.db.checkins = this.db.checkins.filter(
      (c) => !(c.challengeId === post.challengeId && c.userId === me && c.dayNumber === post.dayNumber)
    );
    const ch = this.db.challenges.find((c) => c.id === post.challengeId);
    const part = this.db.participants.find((p) => p.challengeId === post.challengeId && p.userId === me);
    if (ch && part) this.recomputeParticipation(ch, part);
    this.emit();
  }

  private mediaOfPost(postId: string): ChallengePostMedia[] {
    return this.orderedMedia(postId);
  }

  /** Mirror the SQL ledger projection: one check-in row per daily post. */
  private syncLedger(post: ChallengePost) {
    const media = this.orderedMedia(post.id);
    const ck: Checkin = {
      id: `ck-${post.id}`,
      challengeId: post.challengeId,
      userId: post.userId,
      dayNumber: post.dayNumber,
      date: post.postDate,
      note: post.caption,
      mediaUrl: media[0]?.url ?? null,
      mediaType: media[0]?.mediaType ?? null,
      media,
      createdAt: post.createdAt,
    };
    this.db.checkins = this.db.checkins.filter(
      (c) => !(c.challengeId === post.challengeId && c.userId === post.userId && c.dayNumber === post.dayNumber)
    );
    this.db.checkins.push(ck);
  }

  /** Mirror duel_recompute_participation(): counts, day-slot streaks, completion. */
  private recomputeParticipation(ch: Challenge, part: Participation): Participation {
    const mine = this.db.posts
      .filter((p) => p.challengeId === ch.id && p.userId === part.userId)
      .sort((a, b) => a.dayNumber - b.dayNumber);
    const completedDays = mine.length;
    let streak = 0;
    if (mine.length) {
      const top = mine[mine.length - 1].dayNumber;
      let d = top;
      const days = new Set(mine.map((p) => p.dayNumber));
      while (days.has(d)) {
        streak++;
        d--;
      }
    }
    part.completedDays = completedDays;
    part.currentStreak = streak;
    part.longestStreak = Math.max(part.longestStreak, streak);
    part.lastCheckinDate = mine.length ? mine[mine.length - 1].postDate : null;
    if (completedDays >= ch.durationDays && part.status !== 'completed') {
      part.status = 'completed';
      part.completedAt = new Date().toISOString();
      ch.completionCount += 1;
      this.notify(part.userId, {
        kind: 'streak',
        challengeId: ch.id,
        text: `Challenge complete: ${ch.title}. ${ch.durationDays} days, done. Badge earned.`,
      });
    } else if (completedDays < ch.durationDays && part.status === 'completed') {
      part.status = 'active';
      part.completedAt = null;
      ch.completionCount = Math.max(0, ch.completionCount - 1);
    }
    return part;
  }

  private orderedMedia(postId: string): ChallengePostMedia[] {
    return this.db.postMedia
      .filter((m) => m.postId === postId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Back-compat check-in call → one-media daily post. */
  async checkin(
    challengeId: string,
    note: string,
    mediaUrl?: string | null,
    mediaType?: 'image' | 'video' | null,
    dayNumber?: number
  ): Promise<Checkin> {
    const me = this.requireMe();
    const existing = this.db.posts.filter((p) => p.challengeId === challengeId && p.userId === me);
    const day = dayNumber ?? (existing.length ? Math.max(...existing.map((p) => p.dayNumber)) + 1 : 1);
    const media =
      mediaUrl && (mediaType === 'image' || mediaType === 'video')
        ? [{ type: mediaType, url: mediaUrl }]
        : null;
    const { post } = await this.submitDailyPost({ challengeId, dayNumber: day, caption: note, media });
    const ck = this.db.checkins.find(
      (c) => c.challengeId === challengeId && c.userId === me && c.dayNumber === post.dayNumber
    );
    if (!ck) throw new Error('Check-in was not recorded.');
    return clone(ck);
  }

  /* ---------------------------- social actions -------------------------- */

  async toggleLike(id: string): Promise<boolean> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const idx = this.db.likes.findIndex((l) => l.challengeId === id && l.userId === me);
    if (idx >= 0) {
      this.db.likes.splice(idx, 1);
      ch.likeCount = Math.max(0, ch.likeCount - 1);
      this.emit();
      return false;
    }
    this.db.likes.push({ challengeId: id, userId: me, createdAt: new Date().toISOString() });
    ch.likeCount += 1;
    this.track('like', ch);
    if (ch.creatorId !== me) {
      const myProfile = this.db.profiles[me];
      this.notify(ch.creatorId, {
        kind: 'like',
        actorId: me,
        challengeId: ch.id,
        text: `${myProfile?.name ?? 'Someone'} liked your challenge ${ch.title}`,
      });
    }
    this.emit();
    return true;
  }

  async toggleSave(id: string): Promise<boolean> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const idx = this.db.saves.findIndex((s) => s.challengeId === id && s.userId === me);
    if (idx >= 0) {
      this.db.saves.splice(idx, 1);
      ch.saveCount = Math.max(0, ch.saveCount - 1);
      this.emit();
      return false;
    }
    this.db.saves.push({ challengeId: id, userId: me, createdAt: new Date().toISOString() });
    ch.saveCount += 1;
    this.track('save', ch);
    this.emit();
    return true;
  }

  async shareChallenge(id: string): Promise<void> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    this.db.shares.push({ challengeId: id, userId: me, createdAt: new Date().toISOString() });
    ch.shareCount += 1;
    this.track('share', ch);
    this.emit();
  }

  async addComment(id: string, text: string): Promise<ChallengeComment> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const body = text.trim().slice(0, 500);
    if (!body) throw new Error('Comment cannot be empty.');
    const cm: ChallengeComment = {
      id: uid('cm-'),
      challengeId: id,
      userId: me,
      text: body,
      createdAt: new Date().toISOString(),
    };
    this.db.comments.push(cm);
    ch.commentCount += 1;
    this.track('comment', ch);
    if (ch.creatorId !== me) {
      const myProfile = this.db.profiles[me];
      this.notify(ch.creatorId, {
        kind: 'comment',
        actorId: me,
        challengeId: ch.id,
        text: `${myProfile?.name ?? 'Someone'} commented on ${ch.title}`,
      });
    }
    this.emit();
    return clone(cm);
  }

  async deleteComment(id: string): Promise<void> {
    const me = this.requireMe();
    const cm = this.db.comments.find((c) => c.id === id);
    if (!cm) throw new Error('Comment not found.');
    if (cm.userId !== me) throw new Error('You can only delete your own comments.');
    this.db.comments = this.db.comments.filter((c) => c.id !== id);
    const ch = this.db.challenges.find((c) => c.id === cm.challengeId);
    if (ch) ch.commentCount = Math.max(0, ch.commentCount - 1);
    this.emit();
  }

  async viewChallenge(id: string): Promise<void> {
    if (this.viewedThisSession.has(id)) return;
    this.viewedThisSession.add(id);
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch) return;
    ch.viewCount += 1;
    this.track('view', ch);
    this.emit();
  }

  async notInterested(id: string): Promise<void> {
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch || !this.db.meId) return;
    this.track('not_interested', ch);
    this.emit();
  }

  async recordSearch(query: string): Promise<void> {
    const me = this.db.meId;
    if (!me || !query.trim()) return;
    const q = query.trim().slice(0, 120);
    this.db.searches.push({ id: uid('s-'), userId: me, query: q, createdAt: new Date().toISOString() });
    const cat = this.db.categories.find(
      (c) => c.name.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(c.id)
    );
    this.db.activities.push({
      id: uid('a-'),
      userId: me,
      action: 'search',
      categoryId: cat?.id,
      query: q,
      createdAt: new Date().toISOString(),
    });
    if (this.db.searches.length > 400) this.db.searches = this.db.searches.slice(-400);
    this.emit();
  }

  /* ------------------------------ social feed ---------------------------- */

  private postLikeCount(postId: string): number {
    return this.db.postLikes.filter((l) => l.postId === postId).length;
  }

  private postCommentCount(postId: string): number {
    return this.db.postComments.filter((c) => c.checkinId === postId).length;
  }

  private mapPostToFeed(post: ChallengePost): FeedPost {
    const ch = this.db.challenges.find((c) => c.id === post.challengeId);
    if (!ch) throw new Error('Challenge not found.');
    const cat = this.db.categories.find((c) => c.id === ch.categoryId);
    const author = this.db.profiles[post.userId];
    const media = this.orderedMedia(post.id);
    return {
      id: post.id,
      challengeId: post.challengeId,
      challengeTitle: ch.title,
      durationDays: ch.durationDays,
      categoryId: ch.categoryId,
      categoryName: cat?.name ?? '',
      categoryEmoji: cat?.emoji ?? '•',
      authorId: post.userId,
      authorName: author?.name ?? 'DUEL member',
      authorUsername: author?.username ?? 'duelist',
      authorAvatar: author?.avatar ?? null,
      dayNumber: post.dayNumber,
      date: post.postDate,
      note: post.caption,
      mediaUrl: media[0]?.url ?? null,
      mediaType: media[0]?.mediaType ?? null,
      media,
      createdAt: post.createdAt,
      likeCount: this.postLikeCount(post.id) || post.likeCount,
      commentCount: this.postCommentCount(post.id) || post.commentCount,
      iLiked: this.db.postLikes.some((l) => l.postId === post.id && l.userId === this.db.meId),
      isMine: post.userId === this.db.meId,
    };
  }

  async loadFeed(query: FeedQuery): Promise<{ posts: FeedPost[]; hasMore: boolean }> {
    const me = this.db.meId;
    const pageSize = Math.min(Math.max(query.pageSize ?? 18, 1), 40);
    const q = query.query.trim().toLowerCase();

    let list = this.db.posts.filter((p) => {
      const ch = this.db.challenges.find((c) => c.id === p.challengeId);
      if (!ch) return false;
      const media = this.orderedMedia(p.id);
      if (query.mediaType !== 'all' && !media.some((m) => m.mediaType === query.mediaType)) return false;
      if (query.categoryId && ch.categoryId !== query.categoryId) return false;
      if (q && !(p.caption.toLowerCase().includes(q) || ch.title.toLowerCase().includes(q))) return false;
      return true;
    });

    list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500);

    if (query.sort === 'latest' || !me) {
      const page = list.slice(query.page * pageSize, (query.page + 1) * pageSize);
      return { posts: page.map((p) => this.mapPostToFeed(p)), hasMore: (query.page + 1) * pageSize < list.length };
    }

    /* "for you": same weighted formula as SQL duel_feed */
    const aff = computeAffinity(this.db, me);
    const kws = buildUserKeywords(this.db, me);

    const maxCat = Math.max(0.0001, ...Object.values(aff.categories));
    const scored = list.map((p) => {
      const ch = this.db.challenges.find((c) => c.id === p.challengeId)!;
      const catRaw = Math.max(0, aff.categories[ch.categoryId] ?? 0);
      const kwRaw = keywordOverlap(kws, p.caption, ch.title, ch.tags);
      const creatorRaw = creatorAffinity(this.db, me, ch.creatorId);
      const engRaw = Math.log(1 + this.postLikeCount(p.id) + 2 * this.postCommentCount(p.id));
      const ageHours = Math.max(0, (Date.now() - new Date(p.createdAt).getTime()) / 3600_000);
      const freshRaw = Math.exp(-ageHours / 72);
      return { p, catRaw, kwRaw, creatorRaw, engRaw, freshRaw, categoryId: ch.categoryId };
    });
    const maxKw = Math.max(0.0001, ...scored.map((s) => s.kwRaw));
    const maxCreator = Math.max(0.0001, ...scored.map((s) => Math.log(1 + s.creatorRaw)));
    const maxEng = Math.max(0.0001, ...scored.map((s) => s.engRaw));

    const withScore = scored.map((s) => {
      const base =
        0.34 * (s.catRaw / maxCat) +
        0.24 * (s.kwRaw / maxKw) +
        0.16 * (Math.log(1 + s.creatorRaw) / maxCreator) +
        0.12 * (s.engRaw / maxEng) +
        0.14 * s.freshRaw;
      const score = base * 100 + this.postJitter(me, s.p.id) * 0.4;
      return { ...s, score };
    });

    /* diversity: ≤2 per challenge, ≤3 per category, then paginate */
    const perChallenge = new Map<string, number>();
    const perCategory = new Map<string, number>();
    const diverse = withScore
      .sort((a, b) => b.score - a.score)
      .filter((s) => {
        const pc = perChallenge.get(s.p.challengeId) ?? 0;
        const pcat = perCategory.get(s.categoryId) ?? 0;
        if (pc >= 2 || pcat >= 3) return false;
        perChallenge.set(s.p.challengeId, pc + 1);
        perCategory.set(s.categoryId, pcat + 1);
        return true;
      });

    const page = diverse.slice(query.page * pageSize, (query.page + 1) * pageSize);
    return { posts: page.map((s) => this.mapPostToFeed(s.p)), hasMore: (query.page + 1) * pageSize < diverse.length };
  }

  /** Stable per-user jitter (mirrors the SQL hashtext jitter). */
  private postJitter(userId: string, postId: string): number {
    const s = userId + ':' + postId;
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
  }

  async loadChallengePosts(challengeId: string): Promise<FeedPost[]> {
    return this.db.posts
      .filter((p) => p.challengeId === challengeId)
      .sort((a, b) => a.dayNumber - b.dayNumber || a.createdAt.localeCompare(b.createdAt))
      .slice(0, 250)
      .map((p) => this.mapPostToFeed(p));
  }

  async loadUserPosts(userId: string): Promise<FeedPost[]> {
    const target = userId === this.db.meId ? this.db.meId : userId;
    return this.db.posts
      .filter((p) => p.userId === target)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 120)
      .map((p) => this.mapPostToFeed(p));
  }

  async togglePostLike(postId: string): Promise<boolean> {
    const me = this.requireMe();
    const idx = this.db.postLikes.findIndex((l) => l.postId === postId && l.userId === me);
    if (idx >= 0) {
      this.db.postLikes.splice(idx, 1);
      this.emit();
      return false;
    }
    this.db.postLikes.push({ postId, userId: me, createdAt: new Date().toISOString() });
    this.emit();
    return true;
  }

  async loadPostComments(postId: string): Promise<PostComment[]> {
    return this.db.postComments
      .filter((c) => c.checkinId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((c) => ({ ...c }));
  }

  async addPostComment(postId: string, text: string): Promise<PostComment> {
    const me = this.requireMe();
    const body = text.trim().slice(0, 1000);
    if (!body) throw new Error('Comment cannot be empty.');
    const cm: PostComment = {
      id: uid('pc-'),
      checkinId: postId,
      userId: me,
      text: body,
      createdAt: new Date().toISOString(),
    };
    this.db.postComments.push(cm);
    this.emit();
    return { ...cm };
  }

  async loadTrending(limit = 8): Promise<Challenge[]> {
    return [...this.db.challenges]
      .filter((c) => c.status === 'open')
      .sort((a, b) => b.participantCount + b.likeCount * 2 + b.saveCount - (a.participantCount + a.likeCount * 2 + a.saveCount))
      .slice(0, limit)
      .map((c) => clone(c));
  }

  /* ------------------------------- messages ----------------------------- */

  async openThreadWith(userId: string): Promise<string> {
    const me = this.requireMe();
    if (userId === me) throw new Error('You cannot message yourself.');
    const existing = this.db.threads.find((t) => t.userId === userId);
    if (existing) return existing.id;
    const thread: Thread = {
      id: uid('t-'),
      userId,
      messages: [],
      unread: 0,
      online: false,
      otherLastReadAt: null,
      lastMessageAt: null,
    };
    this.db.threads.unshift(thread);
    this.emit();
    return thread.id;
  }

  async sendMessage(threadId: string, text: string): Promise<void> {
    const me = this.requireMe();
    const thread = this.db.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error('Conversation not found.');
    const body = text.trim().slice(0, 2000);
    if (!body) throw new Error('Message cannot be empty.');
    thread.messages.push({ id: uid('m-'), fromMe: true, text: body, at: new Date().toISOString() });
    thread.lastMessageAt = new Date().toISOString();
    this.emit();
  }

  async markThreadRead(threadId: string): Promise<void> {
    const thread = this.db.threads.find((t) => t.id === threadId);
    if (!thread || thread.unread === 0) return;
    thread.unread = 0;
    this.emit();
  }

  /* ----------------------------- notifications -------------------------- */

  markNotificationRead(id: string): void {
    const n = this.db.notifications.find((x) => x.id === id);
    if (n && !n.read) {
      n.read = true;
      this.emit();
    }
  }

  markAllNotificationsRead(): void {
    let changed = false;
    for (const n of this.db.notifications) {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /* ---------------------------- profile / misc -------------------------- */

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    const me = this.requireMe();
    const p = this.db.profiles[me];
    if (!p) throw new Error('Profile not found.');
    if (patch.username !== undefined) {
      const clean = patch.username.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
      if (clean.length < 3) throw new Error('Username must be at least 3 characters (letters, numbers, underscore).');
      if (Object.values(this.db.profiles).some((x) => x.id !== me && x.username.toLowerCase() === clean.toLowerCase())) {
        throw new Error('That username is taken.');
      }
      patch = { ...patch, username: clean };
    }
    Object.assign(p, patch, { id: me, persona: false });
    this.emit();
  }

  async updateSettings(patch: Partial<DuelDB['settings']>): Promise<void> {
    this.db.settings = { ...this.db.settings, ...patch };
    this.emit();
  }

  async blockUser(id: string): Promise<void> {
    if (!this.db.settings.blocked.includes(id)) {
      this.db.settings.blocked = [...this.db.settings.blocked, id];
    }
    this.emit();
  }

  async unblockUser(id: string): Promise<void> {
    this.db.settings.blocked = this.db.settings.blocked.filter((b) => b !== id);
    this.emit();
  }

  async resetDemo(): Promise<void> {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.viewedThisSession.clear();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem('duel.db.v1');
    } catch {
      /* ignore */
    }
    this.db = this.seed();
    this.emit();
  }

  /* ------------------------------- internals ---------------------------- */

  private requireMe(): string {
    if (!this.db.meId) throw new Error('You need to be signed in to do that.');
    return this.db.meId;
  }

  private findChallenge(id: string): Challenge {
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch) throw new Error('Challenge not found.');
    return ch;
  }

  track(action: ActivityAction, ch: Challenge) {
    if (!this.db.meId) return;
    this.db.activities.push({
      id: uid('a-'),
      userId: this.db.meId,
      action,
      challengeId: ch.id,
      categoryId: ch.categoryId,
      bucket: durationBucket(ch.durationDays),
      createdAt: new Date().toISOString(),
    });
    if (this.db.activities.length > 2000) this.db.activities = this.db.activities.slice(-2000);
  }

  private notify(userId: string, n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
    this.db.notifications.unshift({ ...n, id: uid('n-'), at: new Date().toISOString(), read: false });
    if (this.db.notifications.length > 120) this.db.notifications = this.db.notifications.slice(0, 120);
  }

  /** Morning reminder for active challenges without today's check-in. */
  private dailyStreakReminders() {
    const me = this.db.meId;
    if (!me) return;
    const today = isoDay(0);
    for (const p of this.db.participants.filter((x) => x.userId === me && x.status === 'active')) {
      if (p.lastCheckinDate === today || p.completedDays === 0) continue;
      const ch = this.db.challenges.find((c) => c.id === p.challengeId);
      if (!ch) continue;
      const key = `reminder-${p.challengeId}-${today}`;
      if (this.db.notifications.some((n) => n.id === key)) continue;
      this.db.notifications.unshift({
        id: key,
        kind: 'streak',
        challengeId: p.challengeId,
        text: `Day ${p.completedDays + 1} of ${ch.title} is waiting — protect your ${p.currentStreak}-day streak.`,
        at: new Date().toISOString(),
        read: false,
      });
    }
  }
}

let singleton: LocalAdapter | null = null;
export function getLocalAdapter(): LocalAdapter {
  if (!singleton) singleton = new LocalAdapter();
  return singleton;
}
