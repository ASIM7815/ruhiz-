/** DUEL — shared app-level types (profiles, social, settings, routing). */

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
  lastSeenAt?: string | null; // ISO date; drives online/offline status
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
  media?: string | null; // R2 key / URL for a photo or video message
  mediaType?: 'image' | 'video' | null;
  pending?: boolean; // optimistic, not yet confirmed by the server
}

/** A message privacy request (recipient decides: accept → conversation). */
export interface MessageRequest {
  id: string;
  fromId: string; // app id of the sender
  toId: string; // app id of the recipient
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Thread {
  id: string; // conversation id
  userId: string; // the other participant's profile id
  messages: ChatMessage[];
  unread: number;
  online: boolean;
  otherLastReadAt: string | null; // for read receipts on my messages
  lastMessageAt: string | null;
}

export type NotificationKind =
  | 'like' // someone liked your challenge
  | 'comment' // someone commented on your challenge
  | 'join' // someone joined your challenge
  | 'complete' // someone completed your challenge
  | 'checkin' // a participant checked in (challenge owner)
  | 'mention'
  | 'message'
  | 'streak' // your own streak milestone / reminder
  | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  actorId?: string;
  challengeId?: string;
  conversationId?: string;
  text?: string;
  at: string;
  read: boolean;
}

/** Every tracked interaction feeding the DUEL recommendation engine. */
export type ActivityAction =
  | 'view'
  | 'join'
  | 'leave'
  | 'checkin'
  | 'complete'
  | 'like'
  | 'comment'
  | 'save'
  | 'share'
  | 'search'
  | 'create'
  | 'not_interested';

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
  notifJoins: boolean;
  notifMessages: boolean;
  notifMentions: boolean;
  notifStreaks: boolean;
  emailDigest: 'off' | 'daily' | 'weekly';
  twoFactor: boolean;
  loginAlerts: boolean;
}

export type ViewId =
  | 'home'
  | 'explore'
  | 'create'
  | 'challenges'
  | 'progress'
  | 'notifications'
  | 'messages'
  | 'profile'
  | 'settings'
  | 'challenge';

export interface ViewRoute {
  view: ViewId;
  param?: string; // e.g. profile user id, messages thread id, challenge id, explore query
}

/** Where the store's data currently comes from. */
export type DataMode = 'supabase' | 'supabase-pending-migration' | 'supabase-error' | 'supabase-not-configured';
