import type {
  AppNotification,
  Comment,
  NotificationKind,
  Post,
  PostType,
  Thread,
  UserProfile,
} from '@/lib/types';

/**
 * Row mappers + typed queries for the Supabase production schema
 * (supabase/migrations/20260913000000_ruhiz_production.sql).
 * The current user's profile id is surfaced to the UI as the well-known
 * app id "me"; every other profile id is used as-is.
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
    id: row.user_id ? ids.app(row.id) : row.id, // own profile → "me", others → profile id
    username: row.username ?? 'member',
    name: row.display_name ?? row.username ?? 'Ruhiz member',
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

export function mapPost(
  row: any,
  opts: {
    ids: IdMapper;
    problems: { id: string; score: number }[];
    supportedByMe: boolean;
    savedByMe: boolean;
    beenThere: boolean;
    comments: Comment[];
  }
): Post {
  const type: PostType = ['photo', 'video', 'moment', 'question'].includes(row.type) ? row.type : 'moment';
  return {
    id: row.id,
    userId: opts.ids.app(row.user_id),
    type,
    text: row.content ?? '',
    image: row.image_url ?? undefined,
    video: row.video_url ?? undefined,
    topics: row.topics ?? [],
    problems: opts.problems,
    createdAt: row.created_at,
    supports: row.support_count ?? 0,
    shares: row.share_count ?? 0,
    comments: opts.comments,
    commentCount: Math.max(row.comment_count ?? 0, opts.comments.length),
    supportedByMe: opts.supportedByMe,
    savedByMe: opts.savedByMe,
    beenThere: opts.beenThere,
    beenThereCount: row.been_there_count ?? 0,
    views: row.view_count ?? 0,
  };
}

export function mapComment(row: any, ids: IdMapper): Comment {
  return {
    id: row.id,
    userId: ids.app(row.user_id),
    text: row.content,
    createdAt: row.created_at,
  };
}

export function mapNotification(row: any, ids: IdMapper): AppNotification {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    actorId: ids.app(row.actor_id),
    postId: row.post_id ?? undefined,
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
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function chunk<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Loads the signed-in member's profile, creating one if it's missing. */
export async function ensureProfile(sb: SupabaseClientLike, user: { id: string; email?: string; user_metadata?: any }) {
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;

  let base = (user.user_metadata?.username || user.email?.split('@')[0] || 'member')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 24) || 'member';
  let candidate = base;
  let n = 0;
  // uniqueness loop (DB has a unique index on lower(username))
  for (let i = 0; i < 20; i++) {
    const { data: existing } = await sb
      .from('profiles')
      .select('id')
      .ilike('username', candidate)
      .maybeSingle();
    if (!existing) break;
    n += 1;
    candidate = `${base}${n}`;
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
    .order('joined_at', { referencedTable: 'conversations', ascending: false });
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
        userId: convoId, // patched by the store once profiles are known
        messages,
        unread,
        online: false,
        otherLastReadAt: other?.last_read_at ?? null,
        lastMessageAt: r.conversations?.last_message_at ?? messages.at(-1)?.at ?? null,
      },
    };
  });
}
