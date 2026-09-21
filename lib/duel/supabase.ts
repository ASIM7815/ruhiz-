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
import type { Challenge, ChallengeComment, Checkin, CreateChallengeInput, FeedPost, PostComment } from './types';
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
    
    try {
      [profileRows, catRows, chRows, partRows, ckRows, cmRows, likeRows, saveRows, actRows, searchRows, notifRows] =
        await Promise.all([
          this.sb.from('profiles').select('*'),
          this.sb.from('duel_categories').select('*').order('sort'),
          this.sb.from('challenges').select('*').order('created_at', { ascending: false }).limit(400),
          this.sb.from('challenge_participants').select('*').eq('user_id', profile.id),
          this.sb.from('challenge_checkins').select('*').eq('user_id', profile.id).order('checkin_date', { ascending: false }).limit(800),
          this.sb.from('challenge_comments').select('*').order('created_at', { ascending: true }).limit(1500),
          this.sb.from('challenge_likes').select('challenge_id').eq('user_id', profile.id),
          this.sb.from('challenge_saves').select('challenge_id').eq('user_id', profile.id),
          this.sb.from('activities').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(800),
          this.sb.from('searches').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(200),
          this.sb.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(80),
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

  async checkin(
    challengeId: string,
    note: string,
    mediaUrl?: string | null,
    mediaType?: 'image' | 'video' | null,
    dayNumber?: number
  ): Promise<Checkin> {
    // Attempt modern RPC with media parameters
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

    // Fallback if database RPC has older 2-arg signature
    if (error && (error.code === 'PGRST202' || error.message?.includes('parameters'))) {
      const legacyRes = await this.sb.rpc('duel_checkin', {
        p_challenge_id: challengeId,
        p_note: note,
      });
      if (legacyRes.error) throw legacyRes.error;
      data = legacyRes.data;
      error = null;

      // Update the newly created checkin row with mediaUrl/mediaType if present
      if (data?.checkin?.id && (mediaUrl || mediaType)) {
        await this.sb
          .from('challenge_checkins')
          .update({ media_url: mediaUrl ?? null, media_type: mediaType ?? null })
          .eq('id', data.checkin.id);
        data.checkin.media_url = mediaUrl ?? null;
        data.checkin.media_type = mediaType ?? null;
      }
    } else if (error) {
      throw error;
    }

    const row = data?.checkin;
    const part = data?.participation;
    if (part) {
      this.db.participants = this.db.participants.filter((p) => p.challengeId !== challengeId);
      this.db.participants.push(mapParticipation({ ...part, user_id: this.profileId }, this.ids));
    }
    const ck = row ? mapCheckin({ ...row, user_id: this.profileId }, this.ids) : null;
    if (ck) {
      // Update checkins in local db snapshot
      this.db.checkins = this.db.checkins.filter((c) => c.id !== ck.id);
      this.db.checkins.push(ck);
    }
    const ch = this.db.challenges.find((c) => c.id === challengeId);
    if (ch && ck) this.track('checkin', ch);
    this.emit();
    if (!ck) throw new Error('Check-in was not recorded.');
    return ck;
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

  private mapFeedRow(row: any): FeedPost {
    return {
      id: row.post_id,
      challengeId: row.challenge_id,
      challengeTitle: row.challenge_title,
      durationDays: row.duration_days,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryEmoji: row.category_emoji ?? '•',
      authorId: this.ids.app(row.author_id),
      authorName: row.author_name,
      authorUsername: row.author_username,
      authorAvatar: row.author_avatar ?? null,
      dayNumber: row.day_number,
      date: row.checkin_date,
      note: row.note ?? '',
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      createdAt: row.created_at,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      iLiked: Boolean(row.my_liked),
      isMine: Boolean(row.is_mine),
    };
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
    const ch = this.db.challenges.find((c) => c.id === challengeId);
    const { data, error } = await this.sb
      .from('challenge_checkins')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('day_number', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw error;
    // my-liked flags for these posts
    let liked: string[] = [];
    if (this.profileId) {
      const { data: likes } = await this.sb
        .from('checkin_likes')
        .select('checkin_id')
        .eq('user_id', this.profileId);
      liked = (likes ?? []).map((l: any) => l.checkin_id);
    }
    const cat = ch ? this.db.categories.find((c) => c.id === ch.categoryId) : undefined;
    // Media is optional: caption-only entries still belong on the challenge
    // timeline even though they never surface in media discovery feeds.
    return (data as any[]).map((r) => {
      const authorId = this.ids.app(r.user_id);
      const author = this.db.profiles[authorId];
      return {
        id: r.id,
        challengeId: r.challenge_id,
        challengeTitle: ch?.title ?? '',
        durationDays: ch?.durationDays ?? 0,
        categoryId: ch?.categoryId ?? '',
        categoryName: cat?.name ?? '',
        categoryEmoji: cat?.emoji ?? '•',
        authorId,
        authorName: author?.name ?? 'DUEL member',
        authorUsername: author?.username ?? 'duelist',
        authorAvatar: author?.avatar ?? null,
        dayNumber: r.day_number,
        date: r.checkin_date,
        note: r.note ?? '',
        mediaUrl: r.media_url ?? null,
        mediaType: r.media_type ?? null,
        createdAt: r.created_at,
        likeCount: r.like_count ?? 0,
        commentCount: r.comment_count ?? 0,
        iLiked: liked.includes(r.id),
        isMine: r.user_id === this.profileId,
      };
    });
  }

  async togglePostLike(postId: string): Promise<boolean> {
    if (!this.profileId) throw new Error('You need to be signed in to like posts.');
    const { data: existing } = await this.sb
      .from('checkin_likes')
      .select('checkin_id')
      .eq('checkin_id', postId)
      .eq('user_id', this.profileId)
      .maybeSingle();
    if (existing) {
      const { error } = await this.sb
        .from('checkin_likes')
        .delete()
        .eq('checkin_id', postId)
        .eq('user_id', this.profileId);
      if (error) throw error;
      return false;
    }
    const { error } = await this.sb
      .from('checkin_likes')
      .insert({ checkin_id: postId, user_id: this.profileId });
    if (error) throw error;
    return true;
  }

  private mapPostComment(row: any): PostComment {
    return {
      id: row.id,
      checkinId: row.checkin_id,
      userId: this.ids.app(row.user_id),
      text: row.body,
      createdAt: row.created_at,
    };
  }

  async loadPostComments(postId: string): Promise<PostComment[]> {
    const { data, error } = await this.sb
      .from('checkin_comments')
      .select('*')
      .eq('checkin_id', postId)
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
      .from('checkin_comments')
      .insert({ checkin_id: postId, user_id: this.profileId, body })
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
