export type PostType = 'photo' | 'video' | 'moment' | 'question';

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  avatar: string | null; // image URL / data-url; falls back to initials
  avatarHue: number; // used to color the initials avatar
  cover: string | null; // image URL / data-url; falls back to gradient
  bio: string;
  location: string;
  website: string;
  joined: string; // ISO date
  verified: boolean;
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
  image?: string;
  video?: string;
  topics: string[];
  createdAt: string;
  likes: number;
  shares: number;
  comments: Comment[];
  likedByMe: boolean;
  savedByMe: boolean;
  beenThere: boolean;
  beenThereCount: number;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
}

export interface Thread {
  id: string;
  userId: string;
  messages: ChatMessage[];
  unread: number;
  online: boolean;
}

export type NotificationKind = 'like' | 'comment' | 'follow' | 'mention' | 'support';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  postId?: string;
  text?: string;
  at: string;
  read: boolean;
}

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
