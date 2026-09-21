import type { AppNotification, MessageRequest, Settings, Thread, UserProfile } from '@/lib/types';
import type { ActivityAction } from '@/lib/types';
import type { Category, Challenge, ChallengeComment, ChallengePost, Participation, PostComment } from './types';

export interface LinkRow {
  challengeId: string;
  userId: string;
  createdAt: string;
}

export interface PostLinkRow {
  postId: string;
  userId: string;
  createdAt: string;
}

export interface ActivityRow {
  id: string;
  userId: string;
  action: ActivityAction;
  challengeId?: string;
  categoryId?: string;
  bucket?: string;
  query?: string;
  createdAt: string;
}

export interface SearchRow {
  id: string;
  userId: string;
  query: string;
  createdAt: string;
}

/**
 * The normalized DUEL dataset. Every view renders from this single source,
 * which is always real Supabase data (Postgres + RLS). Nothing here is
 * seeded or fabricated: an empty database renders empty states.
 *
 * Hierarchy:  profiles → challenges → challenge_participants → challenge posts
 *             → media + description + per-post engagement (likes/comments/
 *             saves/shares, maintained by database triggers).
 */
export interface DuelDB {
  v: number;
  /** profile id of the signed-in user (app id "me") */
  meId: string | null;
  profiles: Record<string, UserProfile>;
  categories: Category[];
  challenges: Challenge[];
  participants: Participation[];
  /** all public challenge posts (the activity inside each challenge) */
  posts: ChallengePost[];
  /** comments on posts (real data, loaded for the posts above) */
  postComments: PostComment[];
  /** MY engagement with posts (toggle state for the UI) */
  myPostLikes: PostLinkRow[];
  myPostSaves: PostLinkRow[];
  comments: ChallengeComment[];
  likes: LinkRow[];
  saves: LinkRow[];
  shares: LinkRow[];
  activities: ActivityRow[];
  searches: SearchRow[];
  notifications: AppNotification[];
  threads: Thread[];
  messageRequests: MessageRequest[];
  /** server-ranked trending challenge ids (duel_trending RPC), if available */
  trending: string[];
  settings: Settings;
}

export function emptyDB(): DuelDB {
  return {
    v: 1,
    meId: null,
    profiles: {},
    categories: [],
    challenges: [],
    participants: [],
    posts: [],
    postComments: [],
    myPostLikes: [],
    myPostSaves: [],
    comments: [],
    likes: [],
    saves: [],
    shares: [],
    activities: [],
    searches: [],
    notifications: [],
    threads: [],
    messageRequests: [],
    trending: [],
    settings: defaultSettings(),
  };
}

export function defaultSettings(): Settings {
  return {
    theme: 'dark',
    fontSize: 'standard',
    reduceMotion: false,
    profileVisibility: 'public',
    allowMessagesFrom: 'everyone',
    showActivityStatus: true,
    showReadReceipts: true,
    blocked: [],
    notifLikes: true,
    notifComments: true,
    notifJoins: true,
    notifMessages: true,
    notifMentions: true,
    notifStreaks: true,
    emailDigest: 'weekly',
    twoFactor: false,
    loginAlerts: true,
  };
}
