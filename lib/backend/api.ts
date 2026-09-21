import type { AppNotification, NotificationKind, Thread, UserProfile } from '@/lib/types';
import type { Category, Challenge, ChallengeComment, Checkin, Participation } from '@/lib/duel/types';

/**
 * Row mappers + typed helpers for the DUEL production schema
 * (supabase/migrations/20260920000000_duel_platform.sql).
 * The signed-in member's profile id is surfaced to the UI as the app id "me".
 */

export const ME_APP_ID = 'me';

export type SupabaseClientLike = any;

/* ------------------------------------------------------------------ */
/* Error helpers                                                       */
/* ------------------------------------------------------------------ */

/** True when the query failed because the migration hasn't been applied. */
export function isMissingSchema(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = (err.code ?? '').toUpperCase();
  if (['42P01', 'PGRST202', 'PGRST205', 'PGRST302', '42704', '42883'].includes(code)) return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('relation')
  );
}

/* ------------------------------------------------------------------ */
/* Id mapping                                                          */
/* ------------------------------------------------------------------ */

export class IdMapper {
  private toApp = new Map<string, string>();
  private toProfile = new Map<string, string>();

  constructor(meProfileId: string | null) {
    if (meProfileId) this.register(ME_APP_ID, meProfileId);
  }

  register(appId: string, profileId: string) {
    this.toApp.set(profileId, appId);
    this.toProfile.set(appId, profileId);
  }

  app(profileId: string | null | undefined): string {
    if (!profileId) return 'unknown';
    return this.toApp.get(profileId) ?? profileId;
  }

  profile(appId: string | null | undefined): string {
    if (!appId) return '';
    return this.toProfile.get(appId) ?? appId;
  }
}

/* ------------------------------------------------------------------ */
/* Row → app type mappers                                              */
/* ------------------------------------------------------------------ */

export function mapProfile(row: any, ids: IdMapper): UserProfile {
  return {
    id: row.user_id ? ids.app(row.id) : row.id,
    username: row.username ?? 'duelist',
    name: row.display_name ?? row.username ?? 'DUEL member',
    avatar: row.avatar_url ?? null,
    avatarHue: row.avatar_hue ?? 152,
    cover: row.cover_url ?? null,
    bio: row.bio ?? '',
    location: row.location ?? '',
    website: row.website ?? '',
    joined: row.created_at ?? new Date().toISOString(),
    verified: Boolean(row.verified),
    persona: Boolean(row.is_persona),
  };
}

export function mapCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? '•',
    color: row.color ?? '#22d3ee',
    tagline: row.tagline ?? '',
    sort: row.sort ?? 0,
  };
}

export function mapChallenge(row: any): Challenge {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    description: row.description ?? '',
    categoryId: row.category_id,
    durationDays: row.duration_days,
    difficulty: row.difficulty ?? 'medium',
    dailyTask: row.daily_task ?? '',
    coverUrl: row.cover_url ?? null,
    tags: row.tags ?? [],
    status: row.status ?? 'open',
    participantCount: row.participant_count ?? 0,
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    saveCount: row.save_count ?? 0,
    shareCount: row.share_count ?? 0,
    viewCount: row.view_count ?? 0,
    completionCount: row.completion_count ?? 0,
    createdAt: row.created_at,
  };
}

export function mapParticipation(row: any, ids: IdMapper): Participation {
  return {
    challengeId: row.challenge_id,
    userId: ids.app(row.user_id),
    status: row.status ?? 'active',
    joinedAt: row.joined_at,
    currentStreak: row.current_streak ?? 0,
    longestStreak: row.longest_streak ?? 0,
    completedDays: row.completed_days ?? 0,
    lastCheckinDate: row.last_checkin_date ?? null,
    completedAt: row.completed_at ?? null,
  };
}

export function mapCheckin(row: any, ids: IdMapper): Checkin {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    userId: ids.app(row.user_id),
    dayNumber: row.day_number,
    date: row.checkin_date,
    note: row.note ?? '',
    mediaUrl: row.media_url ?? null,
    mediaType: row.media_type ?? null,
    createdAt: row.created_at,
  };
}

export function mapComment(row: any, ids: IdMapper): ChallengeComment {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    userId: ids.app(row.user_id),
    text: row.body,
    createdAt: row.created_at,
  };
}

export function mapNotification(row: any, ids: IdMapper): AppNotification {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    actorId: row.actor_id ? ids.app(row.actor_id) : undefined,
    challengeId: row.challenge_id ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    text: row.body ?? undefined,
    at: row.created_at,
    read: Boolean(row.read),
  };
}

export function mapMessage(row: any, myProfileId: string): Thread['messages'][number] {
  return {
    id: row.id,
    fromMe: row.sender_id === myProfileId,
    text: row.content,
    at: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Shared queries                                                      */
/* ------------------------------------------------------------------ */

function normalizeUsername(value: string | null | undefined): string {
  const cleaned = (value ?? '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
  return cleaned.length >= 3 ? cleaned : 'duelist';
}

function withNumericSuffix(base: string, n: number): string {
  if (n <= 0) return base;
  const suffix = String(n);
  return `${base.slice(0, Math.max(1, 20 - suffix.length))}${suffix}`;
}

/** Loads the signed-in member's profile, creating one if it's missing. */
export async function ensureProfile(sb: SupabaseClientLike, user: { id: string; email?: string; user_metadata?: any }) {
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const base = normalizeUsername(user.user_metadata?.username || user.email?.split('@')[0] || 'duelist');
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const { data: existing } = await sb
      .from('profiles')
      .select('id')
      .ilike('username', candidate)
      .maybeSingle();
    if (!existing) break;
    candidate = withNumericSuffix(base, i + 1);
  }
  const display = user.user_metadata?.display_name || user.user_metadata?.full_name || candidate;
  const { data: created, error: insertErr } = await sb
    .from('profiles')
    .insert({ user_id: user.id, username: candidate, display_name: display })
    .select('*')
    .single();
  if (insertErr) throw insertErr;
  return created;
}

export interface ConversationBundle {
  thread: Thread;
  otherProfileId: string;
}

export async function loadConversations(sb: SupabaseClientLike, myProfileId: string): Promise<ConversationBundle[]> {
  const { data: mine, error } = await sb
    .from('conversation_participants')
    .select('conversation_id, last_read_at, conversations!inner(id, last_message_at, created_at)')
    .eq('user_id', myProfileId)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  const rows: any[] = mine ?? [];
  if (!rows.length) return [];
  const convoIds = [...new Set(rows.map((r) => r.conversation_id as string))];

  const { data: others, error: othersErr } = await sb
    .from('conversation_participants')
    .select('conversation_id, user_id, last_read_at')
    .in('conversation_id', convoIds)
    .neq('user_id', myProfileId);
  if (othersErr) throw othersErr;

  const { data: msgs, error: msgErr } = await sb
    .from('messages')
    .select('*')
    .in('conversation_id', convoIds)
    .order('created_at', { ascending: false })
    .limit(60 * convoIds.length);
  if (msgErr) throw msgErr;

  const byConvo = new Map<string, any[]>();
  for (const m of msgs ?? []) {
    const list = byConvo.get(m.conversation_id) ?? [];
    if (list.length < 40) list.push(m);
    byConvo.set(m.conversation_id, list);
  }

  return rows.map((r) => {
    const convoId = r.conversation_id as string;
    const other = (others ?? []).find((o: any) => o.conversation_id === convoId);
    const otherProfileId = other?.user_id ?? convoId;
    const myLastRead = r.last_read_at as string;
    const messages = (byConvo.get(convoId) ?? [])
      .slice()
      .reverse()
      .map((m) => mapMessage(m, myProfileId));
    const unread = (byConvo.get(convoId) ?? []).filter(
      (m) => m.sender_id !== myProfileId && new Date(m.created_at) > new Date(myLastRead)
    ).length;
    return {
      otherProfileId,
      thread: {
        id: convoId,
        userId: convoId,
        messages,
        unread,
        online: false,
        otherLastReadAt: other?.last_read_at ?? null,
        lastMessageAt: r.conversations?.last_message_at ?? messages.at(-1)?.at ?? null,
      },
    };
  });
}
