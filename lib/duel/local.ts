'use client';

/**
 * DUEL local adapter — a complete in-browser implementation of the DUEL
 * data contract, persisted to localStorage. It is used whenever Supabase
 * environment variables are absent (preview / offline / first-run), and it
 * implements the *same* rules as the SQL migration: counters via triggers
 * here, streak maths, completion detection, notification fan-out and the
 * activity log that feeds recommendations.
 *
 * Community personas react to your actions (joining, commenting, creating)
 * with short delays so notifications and messages behave like a live
 * product. With Supabase configured, real users produce these events and
 * the Supabase adapter replaces this file entirely.
 */

import type { ActivityAction, AppNotification, Thread, UserProfile } from '@/lib/types';
import { uid } from '@/lib/format';
import { defaultSettings, emptyDB, type DuelDB } from './db';
import { isoDay, SEED_CATEGORIES, SEED_CHALLENGES, SEED_COMMENTS, SEED_PROFILES, seedParticipation } from './seed';
import type { Challenge, ChallengeComment, Checkin, CreateChallengeInput, Participation } from './types';
import { durationBucket } from './types';
import type { DuelAdapter } from './adapter';

const STORAGE_KEY = 'duel.db.v1';

const PERSONA_REPLIES = [
  'Nice — day {day} logged on my side too. Keep the chain alive!',
  'That is exactly the push I needed today. Thanks for posting.',
  'Same challenge, different timezone, same struggle. Respect.',
  'Logged. Tomorrow is the hard one, do not break the streak.',
  'Great check-in. The consistency is the whole game here.',
];

const PERSONA_JOIN_NOTES = [
  'just joined your challenge',
  'joined your challenge and logged day 1',
  'is in! Ready for day 1',
];

async function hashPassword(pw: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`duel::${pw}`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `plain::${pw}`; // non-secure contexts (rare) — local demo only
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
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DuelDB;
        if (parsed && parsed.v === 1) loaded = parsed;
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
    db.categories = clone(SEED_CATEGORIES);
    db.challenges = clone(SEED_CHALLENGES) as Challenge[];
    db.profiles = {};
    for (const p of SEED_PROFILES) db.profiles[p.id] = clone(p);
    const { participants, checkins } = seedParticipation();
    db.participants = participants;
    db.checkins = checkins;
    db.comments = clone(SEED_COMMENTS);
    for (const c of db.comments) {
      const ch = db.challenges.find((x) => x.id === c.challengeId);
      if (ch) ch.commentCount += 1;
    }
    db.settings = defaultSettings();
    return db;
  }

  /** Tolerate older persisted shapes without crashing. */
  private migrateShape(db: DuelDB) {
    db.settings = { ...defaultSettings(), ...db.settings };
    db.accounts ??= [];
    db.threads ??= [];
    db.searches ??= [];
    db.activities ??= [];
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
    this.notify(profile.id, { kind: 'system', text: 'Welcome to DUEL — join your first challenge to start a streak.' });
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

  /** Local-only password reset (demo accounts live in this browser). */
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
      participantCount: 1,
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
    this.scheduleCommunityEngagement(ch.id);
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
    if (this.db.participants.some((p) => p.challengeId === id && p.userId === me)) throw new Error('You already joined this challenge.');
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
    if (ch.creatorId !== me && this.db.profiles[ch.creatorId]?.persona) {
      // creator (a real account in production) would be notified here
    }
    this.emit();
  }

  async leaveChallenge(id: string): Promise<void> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const part = this.db.participants.find((p) => p.challengeId === id && p.userId === me);
    if (!part) throw new Error('You have not joined this challenge.');
    if (part.status === 'completed') throw new Error('Completed challenges stay on your record.');
    this.db.participants = this.db.participants.filter((p) => p !== part);
    this.db.checkins = this.db.checkins.filter((c) => !(c.challengeId === id && c.userId === me));
    ch.participantCount = Math.max(0, ch.participantCount - 1);
    this.track('leave', ch);
    this.emit();
  }

  /* ------------------------------- check-ins ---------------------------- */

  async checkin(challengeId: string, note: string): Promise<Checkin> {
    const me = this.requireMe();
    const ch = this.findChallenge(challengeId);
    const part = this.db.participants.find((p) => p.challengeId === challengeId && p.userId === me);
    if (!part) throw new Error('Join the challenge before checking in.');
    if (part.status === 'completed') throw new Error('This challenge is already completed.');
    const today = isoDay(0);
    if (part.lastCheckinDate === today) throw new Error('You already checked in today. Come back tomorrow!');

    const yesterday = isoDay(-1);
    part.currentStreak = part.lastCheckinDate === yesterday ? part.currentStreak + 1 : 1;
    part.longestStreak = Math.max(part.longestStreak, part.currentStreak);
    part.completedDays += 1;
    part.lastCheckinDate = today;

    const ck: Checkin = {
      id: uid('ck-'),
      challengeId,
      userId: me,
      dayNumber: part.completedDays,
      date: today,
      note: note.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    };
    this.db.checkins.push(ck);
    this.track('checkin', ch);

    if (part.completedDays >= ch.durationDays) {
      part.status = 'completed';
      part.completedAt = ck.createdAt;
      ch.completionCount += 1;
      this.track('complete', ch);
      this.notify(me, { kind: 'streak', challengeId, text: `Challenge complete: ${ch.title}. ${ch.durationDays} days, done. Badge earned.` });
    } else if ([3, 7, 14, 21, 30, 50, 100].includes(part.currentStreak)) {
      this.notify(me, { kind: 'streak', challengeId, text: `${part.currentStreak}-day streak on ${ch.title}. Do not break the chain.` });
    }
    this.emit();
    return clone(ck);
  }

  /* ---------------------------- social actions -------------------------- */

  async toggleLike(id: string): Promise<boolean> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const existing = this.db.likes.find((l) => l.challengeId === id && l.userId === me);
    if (existing) {
      this.db.likes = this.db.likes.filter((l) => l !== existing);
      ch.likeCount = Math.max(0, ch.likeCount - 1);
      this.emit();
      return false;
    }
    this.db.likes.push({ challengeId: id, userId: me, createdAt: new Date().toISOString() });
    ch.likeCount += 1;
    this.track('like', ch);
    this.emit();
    return true;
  }

  async toggleSave(id: string): Promise<boolean> {
    const me = this.requireMe();
    const ch = this.findChallenge(id);
    const existing = this.db.saves.find((l) => l.challengeId === id && l.userId === me);
    if (existing) {
      this.db.saves = this.db.saves.filter((l) => l !== existing);
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
    const body = text.trim().slice(0, 1000);
    if (!body) throw new Error('Comment cannot be empty.');
    const cm: ChallengeComment = { id: uid('cm-'), challengeId: id, userId: me, text: body, createdAt: new Date().toISOString() };
    this.db.comments.push(cm);
    ch.commentCount += 1;
    this.track('comment', ch);
    this.emit();
    this.maybePersonaReply(id, body);
    return clone(cm);
  }

  async deleteComment(id: string): Promise<void> {
    const me = this.requireMe();
    const cm = this.db.comments.find((c) => c.id === id);
    if (!cm) return;
    if (cm.userId !== me) throw new Error('You can only delete your own comments.');
    this.db.comments = this.db.comments.filter((c) => c.id !== id);
    const ch = this.db.challenges.find((c) => c.id === cm.challengeId);
    if (ch) ch.commentCount = Math.max(0, ch.commentCount - 1);
    this.emit();
  }

  async viewChallenge(id: string): Promise<void> {
    if (!this.db.meId || this.viewedThisSession.has(id)) return;
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
    const cat = this.db.categories.find((c) => c.name.toLowerCase().includes(q.toLowerCase()) || q.toLowerCase().includes(c.id));
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

  /* ------------------------------- messages ----------------------------- */

  async openThreadWith(userId: string): Promise<string> {
    const me = this.requireMe();
    if (userId === me) throw new Error('You cannot message yourself.');
    const existing = this.db.threads.find((t) => t.userId === userId);
    if (existing) return existing.id;
    const thread: Thread = { id: uid('t-'), userId, messages: [], unread: 0, online: false, otherLastReadAt: null, lastMessageAt: null };
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
    const other = this.db.profiles[thread.userId];
    if (other?.persona) {
      const delay = 1400 + Math.random() * 2600;
      this.timers.push(
        window.setTimeout(() => {
          const reply = PERSONA_REPLIES[Math.floor(Math.random() * PERSONA_REPLIES.length)].replace('{day}', String(Math.floor(Math.random() * 20) + 2));
          thread.messages.push({ id: uid('m-'), fromMe: false, text: reply, at: new Date().toISOString() });
          thread.lastMessageAt = new Date().toISOString();
          if (this.db.meId !== me || document.hidden) thread.unread += 1;
          this.notify(me, { kind: 'message', conversationId: thread.id, actorId: thread.userId, text: reply.slice(0, 120) });
          this.emit();
        }, delay)
      );
    }
  }

  async markThreadRead(threadId: string): Promise<void> {
    const thread = this.db.threads.find((t) => t.id === threadId);
    if (!thread) return;
    if (thread.unread === 0) return;
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
    for (const n of this.db.notifications) if (!n.read) { n.read = true; changed = true; }
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
    Object.assign(p, patch, { id: me, persona: p.persona });
    this.emit();
  }

  async updateSettings(patch: Partial<DuelDB['settings']>): Promise<void> {
    this.db.settings = { ...this.db.settings, ...patch };
    this.emit();
  }

  async blockUser(id: string): Promise<void> {
    if (!this.db.settings.blocked.includes(id)) this.db.settings.blocked = [...this.db.settings.blocked, id];
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
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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

  /** Simulated community: personas join / like / comment on new challenges. */
  private scheduleCommunityEngagement(challengeId: string) {
    const personas = SEED_PROFILES.slice(0, 5);
    const pick = personas[Math.floor(Math.random() * personas.length)];
    this.timers.push(
      window.setTimeout(() => {
        const ch = this.db.challenges.find((c) => c.id === challengeId);
        if (!ch) return;
        const already = this.db.participants.some((p) => p.challengeId === challengeId && p.userId === pick.id);
        if (!already) {
          this.db.participants.push({
            challengeId, userId: pick.id, status: 'active', joinedAt: new Date().toISOString(),
            currentStreak: 1, longestStreak: 1, completedDays: 1, lastCheckinDate: isoDay(0), completedAt: null,
          } as Participation);
          ch.participantCount += 1;
          this.notify(this.db.meId!, {
            kind: 'join', actorId: pick.id, challengeId,
            text: `${pick.name} ${PERSONA_JOIN_NOTES[Math.floor(Math.random() * PERSONA_JOIN_NOTES.length)]}`,
          });
          this.emit();
        }
      }, 18000 + Math.random() * 20000)
    );
    this.timers.push(
      window.setTimeout(() => {
        const ch = this.db.challenges.find((c) => c.id === challengeId);
        if (!ch || !this.db.meId) return;
        ch.likeCount += 1;
        this.db.likes.push({ challengeId, userId: pick.id, createdAt: new Date().toISOString() });
        this.notify(this.db.meId, { kind: 'like', actorId: pick.id, challengeId, text: `${pick.name} liked your challenge ${ch.title}` });
        this.emit();
      }, 34000 + Math.random() * 26000)
    );
  }

  private maybePersonaReply(challengeId: string, _body: string) {
    const ch = this.db.challenges.find((c) => c.id === challengeId);
    if (!ch || ch.creatorId === this.db.meId) return;
    if (Math.random() > 0.6) return;
    const author = this.db.profiles[ch.creatorId];
    if (!author?.persona) return;
    this.timers.push(
      window.setTimeout(() => {
        const target = this.db.challenges.find((c) => c.id === challengeId);
        if (!target) return;
        const cm: ChallengeComment = {
          id: uid('cm-'), challengeId, userId: author.id,
          text: PERSONA_REPLIES[Math.floor(Math.random() * PERSONA_REPLIES.length)].replace('{day}', String(Math.floor(Math.random() * 12) + 2)),
          createdAt: new Date().toISOString(),
        };
        this.db.comments.push(cm);
        target.commentCount += 1;
        this.notify(this.db.meId!, { kind: 'comment', actorId: author.id, challengeId, text: `${author.name} replied to your comment on ${target.title}` });
        this.emit();
      }, 5000 + Math.random() * 9000)
    );
  }
}

let singleton: LocalAdapter | null = null;
export function getLocalAdapter(): LocalAdapter {
  if (!singleton) singleton = new LocalAdapter();
  return singleton;
}
