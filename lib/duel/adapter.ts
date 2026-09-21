import type { ActivityAction, Settings, UserProfile } from '@/lib/types';
import type { DuelDB } from './db';
import type { Challenge, ChallengeComment, ChallengePost, CreateChallengeInput, PostComment } from './types';

export interface BootstrapResult {
  db: DuelDB;
  authed: boolean;
  error?: string;
  pendingMigration?: boolean;
}

/**
 * The DUEL data contract. Views and the store depend only on this interface.
 * The single production implementation is SupabaseAdapter (Postgres + RLS +
 * Realtime). There is intentionally no demo/offline adapter: when Supabase is
 * not configured the app surfaces a clear configuration error instead of
 * inventing fake data.
 */
export interface DuelAdapter {
  readonly kind: 'supabase';
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
  /** submit (or update) a day's progress post inside a challenge */
  checkin(
    challengeId: string,
    note: string,
    mediaUrl?: string | null,
    mediaType?: 'image' | 'video' | null,
    dayNumber?: number
  ): Promise<ChallengePost>;
  /** delete one of my own posts; participation counters recompute server-side */
  deletePost(postId: string): Promise<void>;

  /* challenge-level engagement */
  toggleLike(id: string): Promise<boolean>;
  toggleSave(id: string): Promise<boolean>;
  shareChallenge(id: string): Promise<void>;
  addComment(challengeId: string, text: string): Promise<ChallengeComment>;
  deleteComment(commentId: string): Promise<void>;
  viewChallenge(id: string): Promise<void>;
  notInterested(id: string): Promise<void>;
  recordSearch(query: string): Promise<void>;

  /* post-level engagement (likes/comments/saves/shares on a single post) */
  togglePostLike(postId: string): Promise<boolean>;
  togglePostSave(postId: string): Promise<boolean>;
  sharePost(postId: string): Promise<void>;
  addPostComment(postId: string, text: string): Promise<PostComment>;
  deletePostComment(commentId: string): Promise<void>;

  /* messaging */
  /** resolves to a conversation id, or 'request:pending' when the recipient restricted messages */
  openThreadWith(userId: string): Promise<string>;
  sendMessage(threadId: string, text: string, mediaUrl?: string | null, mediaType?: 'image' | 'video' | null): Promise<void>;
  markThreadRead(threadId: string): Promise<void>;
  acceptMessageRequest(requestId: string): Promise<string>;
  declineMessageRequest(requestId: string): Promise<void>;

  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;

  updateProfile(patch: Partial<UserProfile>): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  blockUser(id: string): Promise<void>;
  unblockUser(id: string): Promise<void>;
}
