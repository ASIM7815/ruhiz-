// Shared API types: the exact JSON shapes returned by /api/*. Timestamps are epoch milliseconds.

export type IdentityMode = "saver" | "revealer";

export type CategoryId =
  | "mental-health"
  | "education"
  | "student-life"
  | "career"
  | "relationships"
  | "family"
  | "technology"
  | "environment"
  | "community"
  | "finance"
  | "health"
  | "self-improvement"
  | "infrastructure";

export type PostKind = "photo" | "video" | "thought";
export type PostIntent = "problem" | "experience" | "thought" | "solution" | "support" | "update";
export type ProblemStatus = "unsolved" | "discussion" | "solutions" | "implementation" | "solved";
export type ContributionType = "experience" | "evidence" | "opinion" | "counter" | "question" | "solution" | "support";
export type HelpType = "knowledge" | "technical" | "research" | "funding" | "equipment" | "volunteering" | "local" | "professional" | "organization" | "other";
export type SolutionStage = "proposed" | "reviewing" | "funding" | "implementing" | "completed";
export type FeedTab = "for-you" | "latest" | "trending" | "nearby" | "unsolved";
export type Availability = "Today" | "This week" | "This month" | "Ongoing" | "One-time";

export interface UserLite {
  code: string;
  avatarUrl: string | null;
  headline: string;
  online: boolean;
  /** Present only when the person chose Identity Revealer for this context. */
  revealed: { name: string; role: string } | null;
  verifiedProfessional?: boolean;
}

export interface Profile extends UserLite {
  bio: string;
  location: string;
  identity: IdentityMode;
  expertise: string[];
  canHelpWith: HelpType[];
  supporters: number;
  supporting: number;
  joinedAt: number;
  impact: { solved: number; solutions: number; helped: number };
  counts: { posts: number; photos: number; videos: number; thoughts: number; contributions: number };
  isMe: boolean;
  supportedByMe: boolean;
}

export interface Settings {
  defaultIdentity: IdentityMode;
  theme: "navy" | "midnight";
  reduceMotion: boolean;
  textSize: "sm" | "md" | "lg";
  messagesFrom: "everyone" | "supporters" | "none";
  showOnline: boolean;
  allowCodeSearch: boolean;
  notify: Record<"supports" | "responses" | "solutions" | "messages" | "help", boolean>;
  language: string;
  region: string;
}

export interface Me {
  code: string;
  email: string;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  location: string;
  identity: IdentityMode;
  revealedName: string;
  revealedRole: string;
  expertise: string[];
  canHelpWith: HelpType[];
  onboarded: boolean;
  /** UI hint only. Every admin action is re-authorised on the server. */
  isAdmin: boolean;
  supporters: number;
  supporting: number;
  settings: Settings;
  joinedAt: number;
}

export interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  /** Intrinsic pixel size, when known (null for files uploaded before sizes were recorded). */
  width: number | null;
  height: number | null;
}

export interface LifecycleUpdate {
  at: number;
  status: ProblemStatus;
  text: string;
  actor: string | null;
}

export interface SolutionLite {
  id: string;
  title: string;
  stage: SolutionStage;
  fundingNeeded: number;
  fundingRaised: number;
}

export interface Post {
  id: string;
  author: UserLite;
  kind: PostKind;
  intent: PostIntent;
  category: CategoryId;
  title: string | null;
  text: string;
  media: MediaItem[];
  createdAt: number;
  editedAt: number | null;
  identity: IdentityMode;
  location: string;
  status: ProblemStatus | null;
  outcome: string | null;
  addresses: { id: string; title: string } | null;
  topSolution: SolutionLite | null;
  counts: { supports: number; cares: number; discussions: number; shares: number; helpers: number };
  helpers: { code: string; avatarUrl: string | null }[];
  viewer: { supported: boolean; cared: boolean; saved: boolean; isOwner: boolean; canModerate: boolean };
  updates?: LifecycleUpdate[];
}

export interface Contribution {
  id: string;
  author: UserLite;
  type: ContributionType;
  text: string;
  source: string | null;
  identity: IdentityMode;
  createdAt: number;
  helpful: number;
  helpfulByMe: boolean;
  parentId: string | null;
  isOwner: boolean;
  canModerate: boolean;
  target?: { kind: "post" | "solution"; id: string; title: string };
}

export interface HelpOffer {
  id: string;
  postId: string;
  postTitle?: string;
  user: UserLite;
  type: HelpType;
  note: string;
  availability: Availability;
  createdAt: number;
  isMine: boolean;
}

export interface Solution {
  id: string;
  problem: { id: string; title: string; status: ProblemStatus | null; authorCode: string } | null;
  author: UserLite;
  title: string;
  summary: string;
  approach: string[];
  resources: string[];
  funding: { needed: number; raised: number };
  skills: { id: string; label: string; filled: number; needed: number; joined: boolean }[];
  timeline: string;
  phases: { label: string; duration: string }[];
  expectedOutcome: string;
  evidence: string[];
  supports: number;
  supportedByMe: boolean;
  savedByMe: boolean;
  stage: SolutionStage;
  contributors: string[];
  createdAt: number;
  outcome: string | null;
  myPledge: number;
  /** Can advance stages (solution author, problem author or admin). */
  canManage: boolean;
  canDelete: boolean;
}

export interface ConversationSummary {
  id: string;
  with: UserLite;
  context: string | null;
  lastMessage: { text: string; fromMe: boolean; at: number } | null;
  unread: number;
}

export interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  at: number;
  attachment: { kind: "post" | "solution"; id: string; title: string } | null;
}

export type NotificationType = "support" | "response" | "solution" | "message" | "help" | "status" | "supporter";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: UserLite;
  text: string;
  at: number;
  read: boolean;
  href: string;
}

export interface SupportListing {
  user: UserLite;
  professional: boolean;
  credential: string | null;
  areas: string[];
  description: string;
  availability: "available" | "busy" | "away";
  languages: string[];
  hours: string;
  approach: string;
  isMe: boolean;
}

export interface MySupportListing {
  listed: boolean;
  areas: string[];
  description: string;
  languages: string[];
  hours: string;
  approach: string;
  availability: "available" | "busy" | "away";
  credential: { type: string; issuingBody: string; registrationNumber: string; status: "pending" | "verified" | "rejected"; reviewNote: string | null } | null;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}
