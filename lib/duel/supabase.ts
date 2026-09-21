'use client';

/**
 * DUEL Supabase adapter — the single production implementation of the DUEL
 * data contract against Postgres (RLS-protected) with Realtime.
 *
 * Hierarchy:  profiles → challenges → challenge_participants → challenge
 * posts (challenge_checkins) → media + description + per-post engagement.
 *
 * Counters, streaks and completion are maintained by database triggers and
 * RPCs (duel_checkin, duel_record_view, recomputation on post delete) so
 * concurrent users can never corrupt them; this adapter mirrors server state
 * into the shared DuelDB snapshot and applies optimistic patches for instant
 * UI feedback. There is no demo/fallback dataset — an empty database yields
 * empty arrays and the UI renders honest empty states.
 */

import type { ActivityAction, AppNotification, Settings, Thread, UserProfile } from '@/lib/types';
import { uid } from '@/lib/format';
import { safeClient } from '@/lib/supabase/client';
import {
  ensureProfile,
  IdMapper,
  isMissingSchema,
  loadConversations,
  mapCategory,
  mapChallenge,
  mapComment,
  mapMessage,
  mapMessageRequest,
  mapNotification,
  mapParticipation,
  mapPost,
  mapPostComment,
  mapProfile,
  ME_APP_ID,
} from '@/lib/backend/api';
import { defaultSettings, emptyDB, type DuelDB } from './db';
import type { BootstrapResult, DuelAdapter } from './adapter';
import type { Challenge, ChallengeComment, ChallengePost, CreateChallengeInput, PostComment } from './types';
import { durationBucket } from './types';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const POST_PAGE_LIMIT = 800;
const IN_CHUNK_SIZE = 150;

export class SupabaseAdapter implements DuelAdapter {
  readonly kind = 'supabase' as const;
  private db: DuelDB = emptyDB();
  private listeners = new Set<(db: DuelDB) => void>();
  private ids = new IdMapper(null);
  private profileId: string | null = null;
  private channels: any[] = [];
  private viewedThisSession = new Set<string>();
  private sb: any = null;

  get meId(): string | null {
    return this.db.meId;
  }

  subscribe(cb: (db: DuelDB) => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private emit() {
    const snap = clone(this.db);
    this.listeners.forEach((l) => l(snap));
  }

  /* ------------------------------ bootstrap ----------------------------- */

  async bootstrap(): Promise<BootstrapResult> {
    this.sb = safeClient();
    if (!this.sb) {
      return {
        db: clone(this.db),
        authed: false,
        error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run the supabase/migrations SQL in your project.',
      };
    }
    const { data } = await this.sb.auth.getSession();
    const user = data?.session?.user;
    if (!user) {
      return { db: clone(this.db), authed: false };
    }

    let profile;
    try {
      profile = await ensureProfile(this.sb, user);
    } catch (err) {
      return { db: clone(this.db), authed: true, error: 'Could not load your profile. Some features may not work.' };
    }

    this.profileId = profile.id;
    this.ids = new IdMapper(profile.id);
    this.db.meId = ME_APP_ID;

    let profileRows, catRows, chRows, partRows, postRows, cmRows, likeRows, saveRows, actRows, searchRows, notifRows;
    try {
      [profileRows, catRows, chRows, partRows, postRows, cmRows, likeRows, saveRows, actRows, searchRows, notifRows] =
        await Promise.all([
          this.sb.from('profiles').select('*'),
          this.sb.from('duel_categories').select('*').order('sort'),
          this.sb.from('challenges').select('*').order('created_at', { ascending: false }).limit(400),
          this.sb.from('challenge_participants').select('*').eq('user_id', profile.id),
          // ALL public challenge posts — the activity inside every challenge
          this.sb.from('challenge_checkins').select('*').order('created_at', { ascending: false }).limit(POST_PAGE_LIMIT),
          this.sb.from('challenge_comments').select('*').order('created_at', { ascending: true }).limit(1500),
          this.sb.from('challenge_likes').select('challenge_id').eq('user_id', profile.id),
          this.sb.from('challenge_saves').select('challenge_id').eq('user_id', profile.id),
          this.sb.from('activities').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(800),
          this.sb.from('searches').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(200),
          this.sb.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(80),
        ]);
    } catch (err) {
      console.error('[SUPABASE BOOTSTRAP] Error loading core data:', err);
      return {
        db: { ...emptyDB(), meId: ME_APP_ID, profiles: { [ME_APP_ID]: mapProfile(profile, this.ids) } },
        authed: true,
        error: 'Could not load DUEL data. The database migration may be pending — run supabase/migrations in the SQL Editor.',
      };
    }

    const profiles: Record<string, UserProfile> = {};
    for (const row of profileRows?.data ?? []) {
      const mapped = mapProfile(row, this.ids);
      profiles[mapped.id] = mapped;
      if (!row.user_id) this.ids.register(row.id, row.id);
    }
    profiles[ME_APP_ID] = mapProfile(profile, this.ids);

    const challenges: Challenge[] = (chRows?.data ?? []).map((r: any) => ({ ...mapChallenge(r), creatorId: this.ids.app(r.creator_id) }));
    const posts: ChallengePost[] = (postRows?.data ?? []).map((r: any) => mapPost(r, this.ids));

    // Challenge comments scoped to the challenges we loaded
    let challengeCommentRows = { data: [] as any[] };
    const challengeIds = challenges.map((c) => c.id);
    if (challengeIds.length) {
      try {
        challengeCommentRows = await this.sb
          .from('challenge_comments')
          .select('*')
          .in('challenge_id', challengeIds)
          .order('created_at', { ascending: true });
      } catch (err) {
        console.error('[SUPABASE BOOTSTRAP] Error loading challenge comments:', err);
      }
    }

    // Post-level social: comments for loaded posts + MY likes/saves (toggle state)
    let postCommentRows: any[] = [];
    let myPostLikes: { post_id: string; created_at: string }[] = [];
    let myPostSaves: { post_id: string; created_at: string }[] = [];
    let messageRequestRows: any[] = [];
    try {
      const postIds = posts.map((p) => p.id);
      postCommentRows = [];
      for (let i = 0; i < postIds.length; i += IN_CHUNK_SIZE) {
        const chunk = postIds.slice(i, i + IN_CHUNK_SIZE);
        const res = await this.sb.from('post_comments').select('*').in('post_id', chunk).order('created_at', { ascending: true });
        if (res.error) throw res.error;
        postCommentRows = postCommentRows.concat(res.data ?? []);
      }
      const [plRes, psRes, mrRes] = await Promise.all([
        this.sb.from('post_likes').select('post_id, created_at').eq('user_id', profile.id),
        this.sb.from('post_saves').select('post_id, created_at').eq('user_id', profile.id),
        this.sb
          .from('message_requests')
          .select('*')
          .or(`to_user.eq.${profile.id},from_user.eq.${profile.id}`)
          .order('created_at', { ascending: false }),
      ]);
      if (plRes.error) throw plRes.error;
      if (psRes.error) throw psRes.error;
      if (mrRes.error) throw mrRes.error;
      myPostLikes = plRes.data ?? [];
      myPostSaves = psRes.data ?? [];
      messageRequestRows = mrRes.data ?? [];
    } catch (err: any) {
      // Phase-2 tables missing (migration 20260921 not applied yet) — core
      // data still works; per-post engagement will surface the error on use.
      console.error('[SUPABASE BOOTSTRAP] Post social unavailable:', err);
    }

    // Server-ranked trending (optional enhancement)
    let trending: string[] = [];
    try {
      const res = await this.sb.rpc('duel_trending', { p_limit: 12 });
      if (res.error) throw res.error;
      trending = (res.data ?? []).map((r: any) => r.id as string);
    } catch (err: any) {
      console.warn('[SUPABASE BOOTSTRAP] duel_trending unavailable, using client-side trends:', err?.message);
    }

    this.db = {
      ...emptyDB(),
      meId: ME_APP_ID,
      profiles,
      categories: (catRows?.data ?? []).map(mapCategory),
      challenges,
      participants: (partRows?.data ?? []).map((r: any) => mapParticipation(r, this.ids)),
      posts,
      postComments: postCommentRows.map((r: any) => mapPostComment(r, this.ids)),
      myPostLikes: myPostLikes.map((r: any) => ({ postId: r.post_id, userId: ME_APP_ID, createdAt: r.created_at })),
      myPostSaves: myPostSaves.map((r: any) => ({ postId: r.post_id, userId: ME_APP_ID, createdAt: r.created_at })),
      comments: challengeCommentRows.data.map((r: any) => mapComment(r, this.ids)),
      likes: (likeRows?.data ?? []).map((r: any) => ({ challengeId: r.challenge_id, userId: ME_APP_ID, createdAt: r.created_at })),
      saves: (saveRows?.data ?? []).map((r: any) => ({ challengeId: r.challenge_id, userId: ME_APP_ID, createdAt: r.created_at })),
      shares: [],
      activities: (actRows?.data ?? []).map((r: any) => ({
        id: r.id, userId: ME_APP_ID, action: r.action, challengeId: r.challenge_id ?? undefined,
        categoryId: r.category_id ?? undefined, bucket: r.bucket ?? undefined, query: r.query ?? undefined, createdAt: r.created_at,
      })),
      searches: (searchRows?.data ?? []).map((r: any) => ({ id: r.id, userId: ME_APP_ID, query: r.query, createdAt: r.created_at })),
      notifications: (notifRows?.data ?? []).map((r: any) => mapNotification(r, this.ids)),
      threads: [],
      messageRequests: messageRequestRows.map((r: any) => mapMessageRequest(r, this.ids)),
      trending,
      settings: { ...defaultSettings(), ...(profile.settings ?? {}) },
    };

    try {
      const bundles = await loadConversations(this.sb, profile.id);
      this.db.threads = bundles.map((b) => ({ ...b.thread, userId: this.ids.app(b.otherProfileId) })) as Thread[];
    } catch (err) {
      console.error('[SUPABASE BOOTSTRAP] Error loading conversations:', err);
      this.db.threads = [];
    }

    this.emit();
    this.subscribeRealtime();
    return { db: clone(this.db), authed: true };
  }

  private subscribeRealtime() {
    this.channels.forEach((c) => this.sb?.removeChannel?.(c));
    this.channels = [];
    if (!this.profileId) return;

    const notifCh = this.sb
      .channel('duel:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${this.profileId}` },
        (payload: any) => {
          const n = mapNotification(payload.new, this.ids);
          if (this.db.notifications.some((x) => x.id === n.id)) return;
          this.db.notifications = [n, ...this.db.notifications].slice(0, 120);
          this.emit();
        }
      )
      .subscribe();
    this.channels.push(notifCh);

    // Live challenge activity: new posts appear in feeds/challenge pages.
    // RLS still applies — only public posts are ever delivered.
    const postCh = this.sb
      .channel('duel:posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'challenge_checkins' },
        (payload: any) => {
          const row = payload.new;
          if (!row?.id) return;
          if (this.db.posts.some((p) => p.id === row.id)) return;
          this.db.posts.unshift(mapPost(row, this.ids));
          this.emit();
        }
      )
      .subscribe();
    this.channels.push(postCh);

    // Live chat: RLS restricts rows to conversations I participate in.
    const msgCh = this.sb
      .channel('duel:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const row = payload.new;
        if (!row?.conversation_id) return;
        const thread = this.db.threads.find((t) => t.id === row.conversation_id);
        if (!thread) return;
        const msg = mapMessage(row, this.profileId!);
        if (thread.messages.some((m) => m.id === msg.id)) return;
        thread.messages.push(msg);
        thread.lastMessageAt = msg.at;
        if (!msg.fromMe) thread.unread += 1;
        this.emit();
      })
      .subscribe();
    this.channels.push(msgCh);
  }

  /* ------------------------------- behaviour ---------------------------- */

  track(action: ActivityAction, challenge: Challenge) {
    if (!this.profileId) return;
    this.db.activities.push({
      id: uid('a-'), userId: ME_APP_ID, action, challengeId: challenge.id,
      categoryId: challenge.categoryId, bucket: durationBucket(challenge.durationDays), createdAt: new Date().toISOString(),
    });
    void Promise.resolve(
      this.sb.rpc('duel_track', {
        p_action: action,
        p_challenge_id: challenge.id,
        p_category_id: challenge.categoryId,
        p_bucket: durationBucket(challenge.durationDays),
        p_query: null,
      })
    ).catch(() => {});
  }

  /* ----------------------------- challenges ----------------------------- */

  async createChallenge(input: CreateChallengeInput): Promise<Challenge> {
    const { data, error } = await this.sb
      .from('challenges')
      .insert({
        creator_id: this.profileId,
        title: input.title,
        description: input.description,
        category_id: input.categoryId,
        duration_days: input.durationDays,
        difficulty: input.difficulty,
        daily_task: input.dailyTask,
        cover_url: input.coverUrl,
        tags: input.tags,
      })
      .select('*')
      .single();
    if (error) throw error;
    const ch: Challenge = { ...mapChallenge(data), creatorId: ME_APP_ID };
    this.db.challenges.unshift(ch);
    this.db.participants.push({
      challengeId: ch.id, userId: ME_APP_ID, status: 'active', joinedAt: ch.createdAt,
      currentStreak: 0, longestStreak: 0, completedDays: 0, lastCheckinDate: null, completedAt: null,
    });
    this.track('create', ch);
    this.emit();
    return clone(ch);
  }

  async updateChallenge(id: string, patch: Partial<Challenge>): Promise<void> {
    const { error } = await this.sb
      .from('challenges')
      .update({
        title: patch.title, description: patch.description, category_id: patch.categoryId,
        duration_days: patch.durationDays, difficulty: patch.difficulty, daily_task: patch.dailyTask,
        cover_url: patch.coverUrl, tags: patch.tags, status: patch.status,
      })
      .eq('id', id)
      .eq('creator_id', this.profileId);
    if (error) throw error;
    this.db.challenges = this.db.challenges.map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.emit();
  }

  async deleteChallenge(id: string): Promise<void> {
    const { error } = await this.sb.from('challenges').delete().eq('id', id).eq('creator_id', this.profileId);
    if (error) throw error;
    this.db.challenges = this.db.challenges.filter((c) => c.id !== id);
    this.db.participants = this.db.participants.filter((p) => p.challengeId !== id);
    this.db.posts = this.db.posts.filter((p) => p.challengeId !== id);
    this.emit();
  }

  async joinChallenge(id: string): Promise<void> {
    const { error } = await this.sb.from('challenge_participants').insert({ challenge_id: id, user_id: this.profileId });
    if (error) throw error;
    const ch = this.db.challenges.find((c) => c.id === id);
    if (ch) {
      ch.participantCount += 1;
      this.track('join', ch);
    }
    this.db.participants.push({
      challengeId: id, userId: ME_APP_ID, status: 'active', joinedAt: new Date().toISOString(),
      currentStreak: 0, longestStreak: 0, completedDays: 0, lastCheckinDate: null, completedAt: null,
    });
    this.emit();
  }

  async leaveChallenge(id: string): Promise<void> {
    const { error } = await this.sb
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', id)
      .eq('user_id', this.profileId)
      .neq('status', 'completed');
    if (error) throw error;
    const ch = this.db.challenges.find((c) => c.id === id);
    if (ch) { ch.participantCount = Math.max(0, ch.participantCount - 1); this.track('leave', ch); }
    this.db.participants = this.db.participants.filter((p) => p.challengeId !== id);
    this.emit();
  }

  /* ------------------------------- posts -------------------------------- */

  /** Submit (or update) a day's progress post inside a challenge. */
  async checkin(
    challengeId: string,
    note: string,
    mediaUrl?: string | null,
    mediaType?: 'image' | 'video' | null,
    dayNumber?: number
  ): Promise<ChallengePost> {
    let data: any = null;
    let error: any = null;
    try {
      const res = await this.sb.rpc('duel_checkin', {
        p_challenge_id: challengeId,
        p_note: note,
        p_media_url: mediaUrl ?? null,
        p_media_type: mediaType ?? null,
        p_day_number: dayNumber ?? null,
      });
      data = res.data;
      error = res.error;
    } catch (rpcErr) {
      error = rpcErr;
    }
    if (error) throw error;

    const row = data?.checkin;
    const part = data?.participation;
    if (part) {
      this.db.participants = this.db.participants.filter((p) => p.challengeId !== challengeId);
      this.db.participants.push(mapParticipation({ ...part, user_id: this.profileId }, this.ids));
    }
    const ck: ChallengePost | null = row ? mapPost({ ...row, user_id: this.profileId }, this.ids) : null;
    if (ck) {
      this.db.posts = this.db.posts.filter((p) => p.id !== ck.id);
      this.db.posts.push(ck);
      this.db.posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const ch = this.db.challenges.find((c) => c.id === challengeId);
    if (ch && ck) this.track('checkin', ch);
    this.emit();
    if (!ck) throw new Error('Check-in was not recorded.');
    return ck;
  }

  /** Delete one of my own posts; the DB recomputes progress/streaks. */
  async deletePost(postId: string): Promise<void> {
    const { error } = await this.sb.from('challenge_checkins').delete().eq('id', postId).eq('user_id', this.profileId);
    if (error) throw error;
    const post = this.db.posts.find((p) => p.id === postId);
    this.db.posts = this.db.posts.filter((p) => p.id !== postId);
    this.db.postComments = this.db.postComments.filter((c) => c.postId !== postId);
    this.db.myPostLikes = this.db.myPostLikes.filter((l) => l.postId !== postId);
    this.db.myPostSaves = this.db.myPostSaves.filter((s) => s.postId !== postId);

    // Fetch the recomputed participation so progress UI stays truthful.
    if (post) {
      const { data: partRows, error: pErr } = await this.sb
        .from('challenge_participants')
        .select('*')
        .eq('challenge_id', post.challengeId)
        .eq('user_id', this.profileId);
      if (!pErr && partRows?.[0]) {
        const fresh = mapParticipation({ ...partRows[0], user_id: this.profileId }, this.ids);
        this.db.participants = [
          ...this.db.participants.filter((p) => p.challengeId !== post.challengeId),
          fresh,
        ];
      }
    }
    this.emit();
  }

  /* -------------------------- challenge engagement ----------------------- */

  async toggleLike(id: string): Promise<boolean> {
    const existing = this.db.likes.find((l) => l.challengeId === id);
    if (existing) {
      const { error } = await this.sb.from('challenge_likes').delete().eq('challenge_id', id).eq('user_id', this.profileId);
      if (error) throw error;
      this.db.likes = this.db.likes.filter((l) => l !== existing);
      const ch = this.db.challenges.find((c) => c.id === id);
      if (ch) ch.likeCount = Math.max(0, ch.likeCount - 1);
      this.emit();
      return false;
    }
    const { error } = await this.sb.from('challenge_likes').insert({ challenge_id: id, user_id: this.profileId });
    if (error) throw error;
    this.db.likes.push({ challengeId: id, userId: ME_APP_ID, createdAt: new Date().toISOString() });
    const ch = this.db.challenges.find((c) => c.id === id);
    if (ch) { ch.likeCount += 1; this.track('like', ch); }
    this.emit();
    return true;
  }

  async toggleSave(id: string): Promise<boolean> {
    const existing = this.db.saves.find((l) => l.challengeId === id);
    if (existing) {
      const { error } = await this.sb.from('challenge_saves').delete().eq('challenge_id', id).eq('user_id', this.profileId);
      if (error) throw error;
      this.db.saves = this.db.saves.filter((l) => l !== existing);
      const ch = this.db.challenges.find((c) => c.id === id);
      if (ch) ch.saveCount = Math.max(0, ch.saveCount - 1);
      this.emit();
      return false;
    }
    const { error } = await this.sb.from('challenge_saves').insert({ challenge_id: id, user_id: this.profileId });
    if (error) throw error;
    this.db.saves.push({ challengeId: id, userId: ME_APP_ID, createdAt: new Date().toISOString() });
    const ch = this.db.challenges.find((c) => c.id === id);
    if (ch) { ch.saveCount += 1; this.track('save', ch); }
    this.emit();
    return true;
  }

  async shareChallenge(id: string): Promise<void> {
    const { error } = await this.sb.from('challenge_shares').insert({ challenge_id: id, user_id: this.profileId });
    if (error) throw error;
    const ch = this.db.challenges.find((c) => c.id === id);
    if (ch) { ch.shareCount += 1; this.track('share', ch); }
    this.emit();
  }

  async addComment(challengeId: string, text: string): Promise<ChallengeComment> {
    const { data, error } = await this.sb
      .from('challenge_comments')
      .insert({ challenge_id: challengeId, user_id: this.profileId, body: text })
      .select('*')
      .single();
    if (error) throw error;
    const cm = mapComment(data, this.ids);
    this.db.comments.push(cm);
    const ch = this.db.challenges.find((c) => c.id === challengeId);
    if (ch) { ch.commentCount += 1; this.track('comment', ch); }
    this.emit();
    return cm;
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.sb.from('challenge_comments').delete().eq('id', commentId).eq('user_id', this.profileId);
    if (error) throw error;
    const cm = this.db.comments.find((c) => c.id === commentId);
    this.db.comments = this.db.comments.filter((c) => c.id !== commentId);
    if (cm) {
      const ch = this.db.challenges.find((c) => c.id === cm.challengeId);
      if (ch) ch.commentCount = Math.max(0, ch.commentCount - 1);
    }
    this.emit();
  }

  async viewChallenge(id: string): Promise<void> {
    if (this.viewedThisSession.has(id)) return;
    this.viewedThisSession.add(id);
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch) return;
    ch.viewCount += 1;
    void Promise.resolve(this.sb.rpc('duel_record_view', { p_challenge_id: id }))
      .then((res: any) => {
        if (!res?.error && typeof res.data === 'number') {
          const target = this.db.challenges.find((c) => c.id === id);
          if (target) target.viewCount = res.data;
          this.emit();
        }
      })
      .catch(() => {});
    this.track('view', ch);
    this.emit();
  }

  async notInterested(id: string): Promise<void> {
    const ch = this.db.challenges.find((c) => c.id === id);
    if (!ch) return;
    this.track('not_interested', ch);
    this.emit();
  }

  async recordSearch(query: string): Promise<void> {
    const q = query.trim().slice(0, 120);
    if (!q) return;
    this.db.searches.unshift({ id: uid('s-'), userId: ME_APP_ID, query: q, createdAt: new Date().toISOString() });
    void Promise.resolve(this.sb.rpc('duel_track', { p_action: 'search', p_challenge_id: null, p_category_id: null, p_bucket: null, p_query: q })).catch(() => {});
    this.emit();
  }

  /* --------------------------- post engagement --------------------------- */

  private findPost(postId: string): ChallengePost {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) throw new Error('This post no longer exists.');
    return post;
  }

  async togglePostLike(postId: string): Promise<boolean> {
    const post = this.findPost(postId);
    const existing = this.db.myPostLikes.find((l) => l.postId === postId);
    if (existing) {
      const { error } = await this.sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', this.profileId);
      if (error) throw error;
      this.db.myPostLikes = this.db.myPostLikes.filter((l) => l !== existing);
      post.likeCount = Math.max(0, post.likeCount - 1);
      this.emit();
      return false;
    }
    const { error } = await this.sb.from('post_likes').insert({ post_id: postId, user_id: this.profileId });
    if (error) throw error;
    this.db.myPostLikes.push({ postId, userId: ME_APP_ID, createdAt: new Date().toISOString() });
    post.likeCount += 1;
    this.emit();
    return true;
  }

  async togglePostSave(postId: string): Promise<boolean> {
    const post = this.findPost(postId);
    const existing = this.db.myPostSaves.find((l) => l.postId === postId);
    if (existing) {
      const { error } = await this.sb.from('post_saves').delete().eq('post_id', postId).eq('user_id', this.profileId);
      if (error) throw error;
      this.db.myPostSaves = this.db.myPostSaves.filter((l) => l !== existing);
      post.saveCount = Math.max(0, post.saveCount - 1);
      this.emit();
      return false;
    }
    const { error } = await this.sb.from('post_saves').insert({ post_id: postId, user_id: this.profileId });
    if (error) throw error;
    this.db.myPostSaves.push({ postId, userId: ME_APP_ID, createdAt: new Date().toISOString() });
    post.saveCount += 1;
    this.emit();
    return true;
  }

  async sharePost(postId: string): Promise<void> {
    const post = this.findPost(postId);
    const { error } = await this.sb.from('post_shares').insert({ post_id: postId, user_id: this.profileId });
    // duplicate (23505) = already shared — treat as a successful re-share
    if (error && !String(error.code ?? '').startsWith('2350')) throw error;
    if (!error) post.shareCount += 1;
    this.emit();
  }

  async addPostComment(postId: string, text: string): Promise<PostComment> {
    const post = this.findPost(postId);
    const { data, error } = await this.sb
      .from('post_comments')
      .insert({ post_id: postId, user_id: this.profileId, body: text })
      .select('*')
      .single();
    if (error) throw error;
    const cm = mapPostComment(data, this.ids);
    this.db.postComments.push(cm);
    post.commentCount += 1;
    this.emit();
    return cm;
  }

  async deletePostComment(commentId: string): Promise<void> {
    const { error } = await this.sb.from('post_comments').delete().eq('id', commentId).eq('user_id', this.profileId);
    if (error) throw error;
    const cm = this.db.postComments.find((c) => c.id === commentId);
    this.db.postComments = this.db.postComments.filter((c) => c.id !== commentId);
    if (cm) {
      const post = this.db.posts.find((p) => p.id === cm.postId);
      if (post) post.commentCount = Math.max(0, post.commentCount - 1);
    }
    this.emit();
  }

  /* ------------------------------- messages ----------------------------- */

  /**
   * Open (or return) a conversation. Resolves to a conversation id, or the
   * literal string 'request:pending' when the recipient's privacy settings
   * (blocked / restricted) turn the attempt into a message request.
   */
  async openThreadWith(userId: string): Promise<string> {
    const existing = this.db.threads.find((t) => t.userId === userId);
    if (existing) return existing.id;
    const otherProfileId = this.ids.profile(userId);
    const { data, error } = await this.sb.rpc('duel_open_conversation', { p_other_user: otherProfileId });
    if (error) throw error;
    const result = String(data ?? '');
    if (result.startsWith('request:')) {
      await this.refreshMessageRequests();
      this.emit();
      return result;
    }
    const bundles = await loadConversations(this.sb, this.profileId!);
    this.db.threads = bundles.map((b) => ({ ...b.thread, userId: this.ids.app(b.otherProfileId) })) as Thread[];
    this.emit();
    return result;
  }

  private async refreshMessageRequests() {
    if (!this.profileId) return;
    const { data, error } = await this.sb
      .from('message_requests')
      .select('*')
      .or(`to_user.eq.${this.profileId},from_user.eq.${this.profileId}`)
      .order('created_at', { ascending: false });
    if (error) return;
    this.db.messageRequests = (data ?? []).map((r: any) => mapMessageRequest(r, this.ids));
  }

  async sendMessage(threadId: string, text: string, mediaUrl?: string | null, mediaType?: 'image' | 'video' | null): Promise<void> {
    const thread = this.db.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error('Conversation not found.');
    const content = text.trim().slice(0, 2000);
    if (!content && !mediaUrl) throw new Error('Message cannot be empty.');
    const { data, error } = await this.sb
      .from('messages')
      .insert({
        conversation_id: threadId,
        sender_id: this.profileId,
        content,
        media_url: mediaUrl ?? null,
        media_type: mediaType ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    const msg = mapMessage(data, this.profileId!);
    thread.messages.push(msg);
    thread.lastMessageAt = msg.at;
    this.emit();
  }

  async markThreadRead(threadId: string): Promise<void> {
    const thread = this.db.threads.find((t) => t.id === threadId);
    if (!thread || thread.unread === 0) return;
    thread.unread = 0;
    this.emit();
    void Promise.resolve(
      this.sb.from('conversation_participants').update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', threadId).eq('user_id', this.profileId)
    ).catch(() => {});
  }

  async acceptMessageRequest(requestId: string): Promise<string> {
    const { data, error } = await this.sb.rpc('duel_accept_message_request', { p_request_id: requestId });
    if (error) throw error;
    const convoId = String(data ?? '');
    const bundles = await loadConversations(this.sb, this.profileId!);
    this.db.threads = bundles.map((b) => ({ ...b.thread, userId: this.ids.app(b.otherProfileId) })) as Thread[];
    await this.refreshMessageRequests();
    this.emit();
    return convoId;
  }

  async declineMessageRequest(requestId: string): Promise<void> {
    const { error } = await this.sb.rpc('duel_decline_message_request', { p_request_id: requestId });
    if (error) throw error;
    await this.refreshMessageRequests();
    this.emit();
  }

  /* ----------------------------- notifications -------------------------- */

  markNotificationRead(id: string): void {
    const n = this.db.notifications.find((x) => x.id === id);
    if (!n || n.read) return;
    n.read = true;
    this.emit();
    void Promise.resolve(this.sb.from('notifications').update({ read: true }).eq('id', id)).catch(() => {});
  }

  markAllNotificationsRead(): void {
    let changed = false;
    for (const n of this.db.notifications) if (!n.read) { n.read = true; changed = true; }
    if (!changed) return;
    this.emit();
    void Promise.resolve(this.sb.from('notifications').update({ read: true }).eq('user_id', this.profileId).eq('read', false)).catch(() => {});
  }

  /* ---------------------------- profile / misc -------------------------- */

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    const { error } = await this.sb
      .from('profiles')
      .update({
        display_name: patch.name, username: patch.username, bio: patch.bio,
        location: patch.location, website: patch.website, avatar_url: patch.avatar, cover_url: patch.cover,
      })
      .eq('id', this.profileId);
    if (error) throw error;
    const me = this.db.profiles[ME_APP_ID];
    if (me) Object.assign(me, patch);
    this.emit();
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.db.settings = { ...this.db.settings, ...patch };
    this.emit();
    void Promise.resolve(this.sb.from('profiles').update({ settings: this.db.settings }).eq('id', this.profileId)).catch(() => {});
  }

  async blockUser(id: string): Promise<void> {
    if (!this.db.settings.blocked.includes(id)) this.db.settings.blocked = [...this.db.settings.blocked, id];
    this.emit();
    await this.updateSettings({ blocked: this.db.settings.blocked });
  }

  async unblockUser(id: string): Promise<void> {
    this.db.settings.blocked = this.db.settings.blocked.filter((b) => b !== id);
    this.emit();
    await this.updateSettings({ blocked: this.db.settings.blocked });
  }

  /** surfaced by the store to explain schema-missing errors */
  static isSchemaError = isMissingSchema;

  notifyLocal(n: AppNotification) {
    this.db.notifications = [n, ...this.db.notifications];
    this.emit();
  }
}
