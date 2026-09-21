import type { AppNotification, Settings, Thread, UserProfile } from '@/lib/types';
import type { ActivityAction } from '@/lib/types';
import type { Category, Challenge, ChallengeComment, Checkin, Participation, PostComment } from './types';

export interface PostLikeRow {
  checkinId: string;
  userId: string;
  createdAt: string;
}

export interface LinkRow {
  challengeId: string;
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

export interface DemoAccount {
  email: string;
  password: string;
  profileId: string;
}

/**
 * The normalized DUEL dataset. Both adapters (local storage and Supabase)
 * hydrate this shape so every view renders from one consistent source.
 */
export interface DuelDB {
  v: number;
  /** profile id of the signed-in user (local account or Supabase profile) */
  meId: string | null;
  accounts: DemoAccount[];
  profiles: Record<string, UserProfile>;
  categories: Category[];
  challenges: Challenge[];
  participants: Participation[];
  checkins: Checkin[];
  comments: ChallengeComment[];
  likes: LinkRow[];
  saves: LinkRow[];
  shares: LinkRow[];
  /** per-post social data (Explore feed / challenge activity) */
  postLikes: PostLikeRow[];
  postComments: PostComment[];
  activities: ActivityRow[];
  searches: SearchRow[];
  notifications: AppNotification[];
  threads: Thread[];
  settings: Settings;
}

export function emptyDB(): DuelDB {
  return {
    v: 1,
    meId: null,
    accounts: [],
    profiles: {},
    categories: [],
    challenges: [],
    participants: [],
    checkins: [],
    comments: [],
    likes: [],
    saves: [],
    shares: [],
    postLikes: [],
    postComments: [],
    activities: [],
    searches: [],
    notifications: [],
    threads: [],
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
