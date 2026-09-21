'use client';

/**
 * DUEL Supabase adapter — production implementation of the DUEL data
 * contract against Postgres (RLS-protected) with Realtime notifications.
 *
 * Counters, streaks and completion are maintained by database triggers and
 * the duel_checkin() RPC so concurrent users can never corrupt them; this
 * adapter mirrors server state into the shared DuelDB snapshot and applies
 * optimistic patches for instant UI feedback.
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
  mapCheckin,
  mapComment,
  mapNotification,
  mapParticipation,
  mapProfile,
  ME_APP_ID,
} from '@/lib/backend/api';
import { defaultSettings, emptyDB, type DuelDB } from './db';
import type { BootstrapResult, DuelAdapter, FeedQuery } from './adapter';
import type { Challenge, ChallengeComment, ChallengePostMedia, Checkin, CreateChallengeInput, FeedPost, Participation, PostComment, SubmitPostInput } from './types';
import { durationBucket } from './types';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

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
    return () => this.listeners.delete(cb);
  }

  private emit() {
    const snap = clone(this.db);
    this.listeners.forEach((l) => l(snap));
  }

  /* ------------------------------ bootstrap ----------------------------- */

  async bootstrap(): Promise<BootstrapResult> {
    console.log('[SUPABASE BOOTSTRAP] Starting...');
    this.sb = safeClient();
    if (!this.sb) {
      console.log('[SUPABASE BOOTSTRAP] No client available, returning unauthed');
      return { db: clone(this.db), authed: false };
    }
    const { data } = await this.sb.auth.getSession();
    console.log('[SUPABASE BOOTSTRAP] Session:', data?.session ? 'EXISTS' : 'NULL', 'User:', data?.session?.user?.email);
    const user = data?.session?.user;
    if (!user) {
      console.log('[SUPABASE BOOTSTRAP] No user in session, returning unauthed');
      return { db: clone(this.db), authed: false };
    }

    console.log('[SUPABASE BOOTSTRAP] User found, ensuring profile...');
    
    // Try to ensure profile, but don't fail auth if this fails
    let profile;
    try {
      profile = await ensureProfile(this.sb, user);
      console.log('[SUPABASE BOOTSTRAP] Profile ensured:', profile.username);
    } catch (err) {
      console.error('[SUPABASE BOOTSTRAP] Failed to ensure profile:', err);
      // User is authenticated even if profile load fails
      return { 
        db: clone(this.db), 
        authed: true, 
        error: 'Could not load your profile. Some features may not work.' 
      };
    }
    
    this.profileId = profile.id;
    this.ids = new IdMapper(profile.id);
    this.db.meId = ME_APP_ID;

    // Load data - if these fail, user is STILL authenticated, just with empty data
    let profileRows, catRows, chRows, partRows, ckRows, cmRows, likeRows, saveRows, actRows, searchRows, notifRows;
    
    let settingsRow = { data: null as any, error: null as any };

    try {
      [profileRows, catRows, chRows, partRows, ckRows, cmRows, likeRows, saveRows, actRows, searchRows, notifRows, settingsRow] =
        await Promise.all([
          this.sb.from('profiles').select('*'),
          this.sb.from('duel_categories').select('*').order('sort'),
          this.sb.from('challenges').select('*').order('created_at', { ascending: false }).limit(400),
          // every participant of the loaded challenges (so detail pages can
          // show and compare real challengers, not just the viewer)
          this.sb.from('challenge_participants').select('*').limit(2000),
          this.sb.from('challenge_checkins').select('*').eq('user_id', profile.id).order('checkin_date', { ascending: false }).limit(800),
          this.sb.from('challenge_comments').select('*').order('created_at', { ascending: true }).limit(1500),
          this.sb.from('challenge_likes').select('challenge_id').eq('user_id', profile.id),
          this.sb.from('challenge_saves').select('challenge_id').eq('user_id', profile.id),
          this.sb.from('activities').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(800),
          this.sb.from('searches').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(200),
          this.sb.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(80),
          this.sb.from('user_settings').select('settings').eq('user_id', profile.id).maybeSingle(),
        ]);

      // Log any errors but don't throw
      for (const [label, res] of [
        ['profiles', profileRows], ['categories', catRows], ['challenges', chRows],
      ] as const) {
        if ((res as any).error) {
          console.error('[SUPABASE BOOTSTRAP] Error loading ' + label + ':', (res as any).error);
        }
      }
      if (partRows?.error) {
        console.error('[SUPABASE BOOTSTRAP] Error loading participants:', partRows.error);
      }
    } catch (err) {
      console.error('[SUPABASE BOOTSTRAP] Error loading data:', err);
      // Return authenticated but with minimal data
      this.db = {
        ...emptyDB(),
        meId: ME_APP_ID,
        profiles: { [ME_APP_ID]: mapProfile(profile, this.ids) },
      };
      return { 
        db: clone(this.db), 
        authed: true, 
        error: 'Could not load DUEL data. Database migration may be pending.' 
      };
    }

    const profiles: Record<string, UserProfile> = {};
    for (const row of profileRows?.data ?? []) {
      const mapped = mapProfile(row, this.ids);
      profiles[mapped.id] = mapped;
      if (!row.user_id) this.ids.register(row.id, row.id);
    }
    profiles[ME_APP_ID] = mapProfile(profile, this.ids);

    const challengeIds = (chRows?.data ?? []).map((r: any) => r.id as string);
    let commentRows = { data: [] as any[], error: null };
    if (challengeIds.length) {
      try {
        commentRows = await this.sb.from('challenge_comments').select('*').in('challenge_id', challengeIds).order('created_at', { ascending: true });
      } catch (err) {
        console.error('[SUPABASE BOOTSTRAP] Error loading comments:', err);
      }
    }

    this.db = {
      ...emptyDB(),
      meId: ME_APP_ID,
      profiles,
      categories: (catRows?.data ?? []).map(mapCategory),
      challenges: (chRows?.data ?? []).map(mapChallenge).map((c: Challenge) => ({ ...c, creatorId: this.ids.app(c.creatorId) })),
      participants: (partRows?.data ?? []).map((r: any) => mapParticipation(r, this.ids)),
      checkins: (ckRows?.data ?? []).map((r: any) => mapCheckin(r, this.ids)),
      comments: (commentRows?.data ?? []).map((r: any) => mapComment(r, this.ids)),
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
      settings: { ...defaultSettings(), ...((settingsRow?.data?.settings as Partial<Settings>) ?? {}) },
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
    console.log('[SUPABASE BOOTSTRAP] Complete! Returning authed = true');
    return { db: clone(this.db), authed: true };
  }

  private subscribeRealtime() {
    this.channels.forEach((c) => this.sb?.removeChannel?.(c));
    this.channels = [];
    if (!this.profileId) return;
    const ch = this.sb
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
    this.channels.push(ch);

    // Live messages: rows arrive for conversations the member is part of;
    // Postgres RLS + the publication scope keep foreign threads invisible.
    const chMsg = this.sb
      .channel('duel:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const row = payload.new ?? {};
          const thread = this.db.threads.find((t) => t.id === row.conversation_id);
          if (!thread || thread.messages.some((m) => m.id === row.id)) return;
          thread.messages.push({
            id: row.id,
            fromMe: row.sender_id === this.profileId,
            text: row.content ?? '',
            at: row.created_at,
          });
          if (!thread.messages[thread.messages.length - 1].fromMe) {
            thread.unread += 1;
          }
          thread.lastMessageAt = row.created_at;
          this.db.threads = [...this.db.threads];
          this.emit();
        }
      )
      .subscribe();
    this.channels.push(chMsg);
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
    const ch = { ...mapChallenge(data), creatorId: ME_APP_ID };
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

  /** Submit (create or edit) a daily post — description + photo/video media. */
  async submitDailyPost(
    input: SubmitPostInput
  ): Promise<{ post: FeedPost; participation: Participation | null }> {
    if (!this.profileId) throw new Error('You need to be signed in to post.');
    const { data, error } = await this.sb.rpc('duel_submit_daily_post', {
      p_challenge_id: input.challengeId,
      p_day_number: input.dayNumber,
      p_caption: input.caption ?? '',
      p_media: input.media,
    });
    if (error) throw error;

    const part = data?.participation;
    if (part) {
      this.db.participants = this.db.participants.filter((p) => p.challengeId !== input.challengeId);
      this.db.participants.push(mapParticipation({ ...part, user_id: this.profileId }, this.ids));
    }

    const row = data?.post;
    if (!row) throw new Error('The daily post was not recorded.');
    const post = this.mapPostRow(row);

    // Keep the derived check-in ledger snapshot in sync for progress views.
    const ck: Checkin = {
      id: row.id,
      challengeId: row.challenge_id,
      userId: ME_APP_ID,
      dayNumber: row.day_number,
      date: row.post_date,
      note: row.caption ?? '',
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      media: post.media,
      createdAt: row.created_at,
    };
    this.db.checkins = this.db.checkins.filter((c) => !(c.challengeId === ck.challengeId && c.userId === ME_APP_ID && c.dayNumber === ck.dayNumber));
    this.db.checkins.push(ck);

    const ch = this.db.challenges.find((c) => c.id === input.challengeId);
    if (ch) this.track('checkin', ch);
    this.emit();
    return {
      post,
      participation: part ? mapParticipation({ ...part, user_id: this.profileId }, this.ids) : null,
    };
  }

  /** Delete one of the caller's own daily posts (RLS enforces ownership). */
  async deletePost(postId: string): Promise<void> {
    if (!this.profileId) throw new Error('You need to be signed in.');
    const { data: mediaRows } = await this.sb.from('challenge_post_media').select('url').eq('post_id', postId);
    const { data: postRow } = await this.sb.from('challenge_posts').select('*').eq('id', postId).maybeSingle();
    const { error } = await this.sb.from('challenge_posts').delete().eq('id', postId);
    if (error) throw error;

    // Best-effort cleanup of owned storage objects (DB rows cascade already).
    for (const m of mediaRows ?? []) {
      if (typeof m.url === 'string' && m.url.startsWith('supa://')) {
        void import('@/lib/upload').then(({ deleteMedia }) => deleteMedia(m.url).catch(() => {}));
      }
    }

    if (postRow) {
      this.db.checkins = this.db.checkins.filter(
        (c) => !(c.challengeId === postRow.challenge_id && c.userId === ME_APP_ID && c.dayNumber === postRow.day_number)
      );
      this.db.participants = this.db.participants.map((p) => {
        if (p.challengeId !== postRow.challenge_id || p.userId !== ME_APP_ID) return p;
        const completedDays = Math.max(0, p.completedDays - 1);
        return {
          ...p,
          completedDays,
          currentStreak: Math.max(0, p.currentStreak - 1),
          status: p.status === 'completed' ? 'active' : p.status,
        };
      });
    }
    this.emit();
  }

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

  /* ------------------------------- feed -------------------------------- */

  private mapMediaList(raw: any): ChallengePostMedia[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((m: any, i: number) => ({
      id: m.id ?? `m-${i}`,
      mediaType: (m.type ?? m.mediaType) === 'video' ? 'video' : 'image',
      url: m.url,
      thumbnailUrl: m.thumbnailUrl ?? null,
      width: m.width ?? null,
      height: m.height ?? null,
      durationMs: m.durationMs ?? null,
      fileSize: m.fileSize ?? null,
      sortOrder: m.sortOrder ?? i,
      createdAt: m.createdAt,
    }));
  }

  /** Row → FeedPost for both duel_feed() and get_challenge_timeline() shapes. */
  private mapFeedRow(row: any): FeedPost {
    const media = this.mapMediaList(row.media);
    const authorId = this.ids.app(row.author_id ?? row.user_id);
    const author = this.db.profiles[authorId];
    return {
      id: row.post_id ?? row.id,
      challengeId: row.challenge_id,
      challengeTitle: row.challenge_title ?? this.db.challenges.find((c) => c.id === row.challenge_id)?.title ?? '',
      durationDays: row.duration_days ?? this.db.challenges.find((c) => c.id === row.challenge_id)?.durationDays ?? 0,
      categoryId: row.category_id ?? this.db.challenges.find((c) => c.id === row.challenge_id)?.categoryId ?? '',
      categoryName: row.category_name ?? '',
      categoryEmoji: row.category_emoji ?? '•',
      authorId,
      authorName: row.author_name ?? row.display_name ?? author?.name ?? 'DUEL member',
      authorUsername: row.author_username ?? row.username ?? author?.username ?? 'duelist',
      authorAvatar: row.author_avatar ?? row.avatar_url ?? author?.avatar ?? null,
      dayNumber: row.day_number,
      date: String(row.checkin_date ?? row.post_date ?? '').slice(0, 10),
      note: row.note ?? row.caption ?? '',
      mediaUrl: media[0]?.url ?? row.media_url ?? null,
      mediaType: media[0]?.mediaType ?? row.media_type ?? null,
      media,
      createdAt: row.created_at,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      iLiked: Boolean(row.my_liked),
      isMine: row.is_mine !== undefined ? Boolean(row.is_mine) : (row.author_id ?? row.user_id) === this.profileId,
    };
  }

  /** Row → Checkin (derived ledger / progress views). */
  private postRowToCheckin(row: any): Checkin {
    const post = this.mapFeedRow(row);
    return {
      id: post.id,
      challengeId: post.challengeId,
      userId: post.authorId,
      dayNumber: post.dayNumber,
      date: post.date,
      note: post.note,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      media: post.media,
      createdAt: post.createdAt,
    };
  }

  /** Raw challenge_posts row (to_jsonb + media) → FeedPost. */
  private mapPostRow(row: any): FeedPost {
    return this.mapFeedRow({
      post_id: row.id,
      challenge_id: row.challenge_id,
      author_id: row.user_id,
      day_number: row.day_number,
      checkin_date: row.post_date,
      note: row.caption,
      created_at: row.created_at,
      like_count: row.like_count,
      comment_count: row.comment_count,
      my_liked: false,
      media: row.media,
    });
  }

  async loadFeed(query: FeedQuery): Promise<{ posts: FeedPost[]; hasMore: boolean }> {
    const pageSize = Math.min(Math.max(query.pageSize ?? 18, 1), 40);
    const { data, error } = await this.sb.rpc('duel_feed', {
      p_media_type: query.mediaType === 'all' ? null : query.mediaType,
      p_category: query.categoryId,
      p_query: query.query || null,
      p_sort: query.sort,
      p_limit: pageSize,
      p_offset: query.page * pageSize,
    });
    if (error) throw error;
    const posts = (data as any[]).map((r) => this.mapFeedRow(r));
    return { posts, hasMore: posts.length === pageSize };
  }

  async loadChallengePosts(challengeId: string): Promise<FeedPost[]> {
    const { data, error } = await this.sb.rpc('get_challenge_timeline', {
      p_challenge_id: challengeId,
    });
    if (error) throw error;
    const posts = (data as any[]).map((r) =>
      this.mapFeedRow({
        ...r,
        post_id: r.post_id ?? r.id,
        checkin_date: r.post_date ?? r.checkin_date,
        note: r.caption ?? r.note,
      })
    );
    // my-liked flags for these posts (used by lightboxes on the timeline)
    if (this.profileId && posts.length) {
      const { data: likes } = await this.sb
        .from('challenge_post_likes')
        .select('post_id')
        .eq('user_id', this.profileId)
        .in('post_id', posts.map((p) => p.id));
      const liked = new Set((likes ?? []).map((l: any) => l.post_id));
      for (const p of posts) p.iLiked = liked.has(p.id);
    }
    return posts;
  }

  async loadUserPosts(userId: string): Promise<FeedPost[]> {
    const profileId = userId === ME_APP_ID || userId === this.db.meId ? this.profileId : this.ids.profile(userId);
    const { data, error } = await this.sb.rpc('get_user_posts', { p_user: profileId });
    if (error) throw error;
    return (data as any[]).map((r) => this.mapFeedRow(r));
  }

  async togglePostLike(postId: string): Promise<boolean> {
    if (!this.profileId) throw new Error('You need to be signed in to like posts.');
    const { data: existing } = await this.sb
      .from('challenge_post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', this.profileId)
      .maybeSingle();
    if (existing) {
      const { error } = await this.sb
        .from('challenge_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', this.profileId);
      if (error) throw error;
      return false;
    }
    const { error } = await this.sb
      .from('challenge_post_likes')
      .insert({ post_id: postId, user_id: this.profileId });
    if (error) throw error;
    return true;
  }

  private mapPostComment(row: any): PostComment {
    return {
      id: row.id,
      checkinId: row.post_id ?? row.checkin_id,
      userId: this.ids.app(row.user_id),
      text: row.body,
      createdAt: row.created_at,
    };
  }

  async loadPostComments(postId: string): Promise<PostComment[]> {
    const { data, error } = await this.sb
      .from('challenge_post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((r: any) => this.mapPostComment(r));
  }

  async addPostComment(postId: string, text: string): Promise<PostComment> {
    const body = text.trim().slice(0, 1000);
    if (!body) throw new Error('Comment cannot be empty.');
    if (!this.profileId) throw new Error('You need to be signed in to comment.');
    const { data, error } = await this.sb
      .from('challenge_post_comments')
      .insert({ post_id: postId, user_id: this.profileId, body })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapPostComment(data);
  }

  async loadTrending(limit = 8): Promise<Challenge[]> {
    const { data, error } = await this.sb.rpc('duel_trending', { p_limit: limit });
    if (error) throw error;
    return (data as any[]).map((r) => ({ ...mapChallenge(r), creatorId: this.ids.app(r.creator_id) }));
  }

  /* ------------------------------- messages ----------------------------- */

  async openThreadWith(userId: string): Promise<string> {
    const existing = this.db.threads.find((t) => t.userId === userId);
    if (existing) return existing.id;
    const otherProfileId = this.ids.profile(userId);
    const { data, error } = await this.sb.rpc('duel_open_conversation', { p_other_user: otherProfileId });
    if (error) throw error;
    const convoId = data as string;
    const bundles = await loadConversations(this.sb, this.profileId!);
    const bundle = bundles.find((b) => b.thread.id === convoId);
    const thread: Thread = bundle?.thread ?? { id: convoId, userId, messages: [], unread: 0, online: false, otherLastReadAt: null, lastMessageAt: null };
    this.db.threads = [{ ...thread, userId }, ...this.db.threads.filter((t) => t.id !== convoId)];
    this.emit();
    return convoId;
  }

  async sendMessage(threadId: string, text: string): Promise<void> {
    const thread = this.db.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error('Conversation not found.');
    const { error } = await this.sb.from('messages').insert({ conversation_id: threadId, sender_id: this.profileId, content: text });
    if (error) throw error;
    thread.messages.push({ id: uid('m-'), fromMe: true, text, at: new Date().toISOString() });
    thread.lastMessageAt = new Date().toISOString();
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
    void Promise.resolve(
      this.sb
        .from('user_settings')
        .upsert({ user_id: this.profileId, settings: this.db.settings, updated_at: new Date().toISOString() })
    ).catch(() => {});
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

  async resetDemo(): Promise<void> {
    /* no-op in production: data lives in Postgres */
  }

  /** surfaced by the store to explain schema-missing errors */
  static isSchemaError = isMissingSchema;

  notifyLocal(n: AppNotification) {
    this.db.notifications = [n, ...this.db.notifications];
    this.emit();
  }
}
