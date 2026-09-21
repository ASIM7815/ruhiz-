import type { ActivityAction, Settings, UserProfile } from '@/lib/types';
import type { DuelDB } from './db';
import type { Challenge, ChallengeComment, Checkin, CreateChallengeInput, FeedMediaType, FeedPost, FeedSort, PostComment } from './types';

/** Filters for the social post feed (Explore). */
export interface FeedQuery {
  mediaType: FeedMediaType;
  categoryId: string | null;
  query: string;
  sort: FeedSort;
  page: number; // 0-based
  pageSize?: number;
}

export interface BootstrapResult {
  db: DuelDB;
  authed: boolean;
  error?: string;
  pendingMigration?: boolean;
}

/**
 * The DUEL data contract. Two implementations exist:
 *  - LocalAdapter   (localStorage, preview / offline mode)
 *  - SupabaseAdapter (Postgres + RLS + Realtime, production)
 * The store and every view depend only on this interface.
 */
export interface DuelAdapter {
  readonly kind: 'local' | 'supabase';
  readonly meId: string | null;

  bootstrap(): Promise<BootstrapResult>;
  subscribe(cb: (db: DuelDB) => void): () => void;

  /** behaviour signal for the recommendation engine */
  track(action: ActivityAction, challenge: Challenge): void;

  createChallenge(input: CreateChallengeInput): Promise<Challenge>;
  updateChallenge(id: string, patch: Partial<Challenge>): Promise<void>;
  deleteChallenge(id: string): Promise<void>;
  joinChallenge(id: string): Promise<void>;
  leaveChallenge(id: string): Promise<void>;
  checkin(
    challengeId: string,
    note: string,
    mediaUrl?: string | null,
    mediaType?: 'image' | 'video' | null,
    dayNumber?: number
  ): Promise<Checkin>;
  toggleLike(id: string): Promise<boolean>;
  toggleSave(id: string): Promise<boolean>;
  shareChallenge(id: string): Promise<void>;
  addComment(challengeId: string, text: string): Promise<ChallengeComment>;
  deleteComment(commentId: string): Promise<void>;
  viewChallenge(id: string): Promise<void>;
  notInterested(id: string): Promise<void>;
  recordSearch(query: string): Promise<void>;

  /* ---- social post feed (Explore) + per-post interactions ---- */
  /** Public posts ranked for discovery (Explore). */
  loadFeed(query: FeedQuery): Promise<{ posts: FeedPost[]; hasMore: boolean }>;
  /** All public posts belonging to one challenge (its activity timeline). */
  loadChallengePosts(challengeId: string): Promise<FeedPost[]>;
  togglePostLike(postId: string): Promise<boolean>;
  loadPostComments(postId: string): Promise<PostComment[]>;
  addPostComment(postId: string, text: string): Promise<PostComment>;
  /** True top-N open challenges (Home trending). */
  loadTrending(limit?: number): Promise<Challenge[]>;

  openThreadWith(userId: string): Promise<string>;
  sendMessage(threadId: string, text: string): Promise<void>;
  markThreadRead(threadId: string): Promise<void>;

  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;

  updateProfile(patch: Partial<UserProfile>): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  blockUser(id: string): Promise<void>;
  unblockUser(id: string): Promise<void>;
  resetDemo(): Promise<void>;

  /* local-only demo auth (absent when Supabase is configured) */
  demoSignUp?(input: { email: string; password: string; name: string; username: string }): Promise<void>;
  demoLogin?(email: string, password: string): Promise<void>;
  demoLogout?(): Promise<void>;
  demoResetPassword?(email: string, newPassword: string): Promise<void>;
}
