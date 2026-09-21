/** DUEL — challenge domain types. */

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string; // hex accent used on cards / chips
  tagline: string;
  sort: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export type ChallengeStatus = 'open' | 'closed';

export interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  categoryId: string;
  durationDays: number; // 1..365
  difficulty: Difficulty;
  dailyTask: string; // what a daily check-in means for this challenge
  coverUrl: string | null; // public URL or R2 key
  tags: string[];
  status: ChallengeStatus;
  participantCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  shareCount: number;
  viewCount: number;
  completionCount: number;
  createdAt: string;
}

export type ParticipationStatus = 'active' | 'completed' | 'abandoned';

export interface Participation {
  challengeId: string;
  userId: string;
  status: ParticipationStatus;
  joinedAt: string;
  currentStreak: number; // consecutive daily check-ins
  longestStreak: number;
  completedDays: number; // total check-ins
  lastCheckinDate: string | null; // yyyy-mm-dd
  completedAt: string | null;
}

export interface Checkin {
  id: string;
  challengeId: string;
  userId: string;
  dayNumber: number; // 1-based day of the challenge for this user
  date: string; // yyyy-mm-dd
  note: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  /** full media set when the check-in was derived from a daily post */
  media?: ChallengePostMedia[];
  createdAt: string;
}

export interface ChallengeComment {
  id: string;
  challengeId: string;
  userId: string;
  text: string;
  createdAt: string;
}

/** Media file attached to a daily post (shared by every view). */
export interface ChallengePostMedia {
  id: string;
  /** owning post id (populated locally; implied by the parent row in SQL) */
  postId?: string;
  mediaType: 'image' | 'video';
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fileSize: number | null;
  sortOrder: number;
  createdAt?: string;
}

/** A daily post (challenge_posts row) enriched for social feeds. */
export interface FeedPost {
  id: string;
  challengeId: string;
  challengeTitle: string;
  durationDays: number;
  categoryId: string;
  categoryName: string;
  categoryEmoji: string;
  authorId: string; // app id ('me' for the viewer's own posts)
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
  dayNumber: number;
  date: string; // yyyy-mm-dd (the challenge day this entry documents)
  note: string;
  /** first media item — convenience for tiles (null on text-only posts) */
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  /** every media file attached to the post, in display order */
  media: ChallengePostMedia[];
  createdAt: string;
  likeCount: number;
  commentCount: number;
  iLiked: boolean;
  isMine: boolean;
}

export interface PostComment {
  id: string;
  checkinId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export type FeedMediaType = 'all' | 'image' | 'video';
export type FeedSort = 'for_you' | 'latest';

/** A challenge enriched with category/creator + the viewer's relationship to it. */
export interface ChallengeView extends Challenge {
  category?: Category;
  joined: boolean;
  liked: boolean;
  saved: boolean;
  participation: Participation | null;
  /** recommendation score (only present on ranked feeds) */
  score?: number;
  /** human-readable recommendation explanation */
  reason?: string;
}

export interface CreateChallengeInput {
  title: string;
  description: string;
  categoryId: string;
  durationDays: number;
  difficulty: Difficulty;
  dailyTask: string;
  coverUrl: string | null;
  tags: string[];
}

export interface RecommendationExplanation {
  score: number;
  reason: string;
}

export interface SearchResults {
  challenges: ChallengeView[];
  categories: Category[];
  people: { id: string; name: string; username: string }[];
}

/** Duration buckets used by the recommendation engine. */
export type DurationBucket = 'sprint' | 'short' | 'classic' | 'marathon';

export function durationBucket(days: number): DurationBucket {
  if (days <= 7) return 'sprint';
  if (days <= 14) return 'short';
  if (days <= 30) return 'classic';
  return 'marathon';
}

export const DURATION_BUCKET_LABEL: Record<DurationBucket, string> = {
  sprint: '≤ 7 days',
  short: '8–14 days',
  classic: '15–30 days',
  marathon: '30+ days',
};

// ============================================================================
// CHALLENGE POSTS — the unified daily-entry model
//   Challenge → Participants → Daily Posts → Media
// ============================================================================

/** Daily entry/post inside a challenge */
export interface ChallengePost {
  id: string;
  challengeId: string;
  userId: string;
  dayNumber: number;
  postDate: string; // yyyy-mm-dd — the challenge day this entry documents
  caption: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChallengePostLike {
  postId: string;
  userId: string;
  createdAt: string;
}

export interface ChallengePostComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
}

/** One media file to attach to a submitted daily post. */
export interface PostMediaInput {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fileSize?: number | null;
}

export interface SubmitPostInput {
  challengeId: string;
  dayNumber: number;
  caption: string;
  /** null keeps the existing media set (caption-only edit) */
  media: PostMediaInput[] | null;
}
