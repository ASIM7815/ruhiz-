export type PostType = 'photo' | 'video' | 'moment' | 'question';

/** Deterministic problem categories used by the Ruhiz recommendation system. */
export interface ProblemCategory {
  id: string;
  label: string;
  emoji: string;
  keywords: string[]; // single words or multi-word phrases, lowercase
}

export interface PostProblem {
  id: string;
  score: number; // 0..1 share of the post's classification mass
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  avatar: string | null; // image URL / R2 key / data-url; falls back to initials
  avatarHue: number; // used to color the initials avatar
  cover: string | null; // image URL / R2 key; falls back to gradient
  bio: string;
  location: string;
  website: string;
  joined: string; // ISO date
  verified: boolean;
  persona?: boolean; // seeded community profile (no login)
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  type: PostType;
  text: string;
  image?: string; // public URL or private R2 object key
  video?: string; // public URL or private R2 object key
  topics: string[];
  problems: PostProblem[]; // classified problem categories (recommendation input)
  createdAt: string;
  supports: number; // "Support" reactions (replaces likes)
  shares: number;
  comments: Comment[];
  commentCount: number;
  supportedByMe: boolean;
  savedByMe: boolean;
  beenThere: boolean;
  beenThereCount: number;
  views: number;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
  pending?: boolean; // optimistic, not yet confirmed by the server
}

export interface Thread {
  id: string; // conversation id (uuid in production, local id in demo)
  userId: string; // the other participant's profile id
  messages: ChatMessage[];
  unread: number;
  online: boolean;
  otherLastReadAt: string | null; // for read receipts on my messages
  lastMessageAt: string | null;
}

export type NotificationKind =
  | 'support' // someone supported your post
  | 'comment'
  | 'person_support' // someone new supports you (was "follow")
  | 'mention'
  | 'message';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  postId?: string;
  conversationId?: string;
  text?: string;
  at: string;
  read: boolean;
}

/** Every tracked interaction feeding the recommendation engine. */
export type ActivityAction =
  | 'view'
  | 'watch'
  | 'support'
  | 'comment'
  | 'save'
  | 'share'
  | 'search'
  | 'ignore'
  | 'not_interested'
  | 'been_there';

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'compact' | 'standard' | 'large';
  reduceMotion: boolean;
  profileVisibility: 'public' | 'connections' | 'private';
  allowMessagesFrom: 'everyone' | 'connections' | 'none';
  showActivityStatus: boolean;
  showReadReceipts: boolean;
  blocked: string[];
  notifLikes: boolean;
  notifComments: boolean;
  notifFollows: boolean;
  notifMessages: boolean;
  notifMentions: boolean;
  emailDigest: 'off' | 'daily' | 'weekly';
  twoFactor: boolean;
  loginAlerts: boolean;
}

export type ViewId =
  | 'home'
  | 'explore'
  | 'journey'
  | 'connections'
  | 'messages'
  | 'notifications'
  | 'saved'
  | 'profile'
  | 'settings';

export interface ViewRoute {
  view: ViewId;
  param?: string; // e.g. profile user id, messages thread id, explore query
}

/** Where the store's data currently comes from. */
export type DataMode = 'demo' | 'supabase' | 'supabase-pending-migration' | 'supabase-error';
