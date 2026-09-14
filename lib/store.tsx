'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ActivityAction,
  AppNotification,
  DataMode,
  Post,
  Session,
  Settings,
  Thread,
  UserProfile,
} from './types';
import {
  CANNED_REPLIES,
  DEFAULT_SETTINGS,
  ME_ID,
  SAMPLE_FOLLOWERS,
  SAMPLE_FOLLOWING,
  SAMPLE_NOTIFICATIONS,
  SAMPLE_POSTS,
  SAMPLE_SESSIONS,
  SAMPLE_THREADS,
  SAMPLE_USERS,
} from './data/sample';
import { uid } from './format';
import { isSupabaseConfigured } from './config';
import { getTracker } from './recsys/track';
import { classifyPost } from './recsys/classifier';
import { rankFeed, explorationLevel, type RankedPost } from './recsys/engine';
import {
  ensureProfile,
  IdMapper,
  isMissingSchema,
  loadConversations,
  mapComment,
  mapNotification,
  mapPost,
  mapProfile,
} from './backend/api';
import { safeClient } from './supabase/client';

const STORAGE_KEY = 'ruhiz.app.v2';

/** Pass-through so Promise.all can await PostgrestBuilder thenables. */
const safeAll = (q: any) => q;

/** Fire-and-forget a Supabase query builder (they lack `.catch`). */
const fire = (q: any) => {
  void Promise.resolve(q).catch(() => {});
};
const ME_APP_ID_CONST = ME_ID;

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface CreatePostInput {
  type: Post['type'];
  text: string;
  image?: string;
  video?: string;
  topics: string[];
}

interface StoreShape {
  hydrated: boolean;
  /** demo = sample data; supabase = live; pending/error = signed in, but live data did not load */
  dataMode: DataMode;
  demoMode: boolean;
  authError: string | null;
  authEmail: string | null;
  authUserId: string | null;
  me: UserProfile;
  users: Record<string, UserProfile>;
  posts: Post[];
  /** Recommendation-ranked "For you" feed (deterministic per user + day). */
  rankedFeed: RankedPost[];
  feedReasons: Record<string, string>;
  interestScores: Record<string, number>;
  explorationLevel: number;
  following: string[];
  followers: string[];
  threads: Thread[];
  notifications: AppNotification[];
  settings: Settings;
  sessions: Session[];
  typing: Record<string, boolean>;
  toasts: Toast[];
  onlineIds: string[];
  unreadMessages: number;
  unreadNotifications: number;
  getUser: (id: string) => UserProfile;
  isFollowing: (id: string) => boolean;
  toast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
  createPost: (input: CreatePostInput) => Promise<Post>;
  updatePost: (id: string, patch: Partial<Pick<Post, 'text' | 'topics'>>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  toggleSupport: (id: string) => void;
  toggleSave: (id: string) => void;
  toggleBeenThere: (id: string) => void;
  addComment: (postId: string, text: string) => void;
  sharePost: (postId: string, threadId?: string) => void;
  toggleFollow: (userId: string) => void;
  removeFollower: (userId: string) => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  sendMessage: (threadId: string, text: string) => Promise<void>;
  openThreadWith: (userId: string) => Promise<string>;
  markThreadRead: (threadId: string) => void;
  sendTyping: (threadId: string) => void;
  setActiveThread: (threadId: string | null) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  blockUser: (id: string) => void;
  unblockUser: (id: string) => void;
  revokeSession: (id: string) => void;
  resetDemo: () => void;
  /** Recommendation signal — view / watch / support / search / ignore / not_interested */
  trackActivity: (
    action: ActivityAction,
    opts?: { post?: Post; query?: string; meta?: Record<string, unknown> }
  ) => void;
  trackSearch: (query: string) => void;
  hidePost: (postId: string, opts?: { problemId?: string; notInterested?: boolean }) => void;
  refreshPosts: () => Promise<void>;
}

const StoreContext = createContext<StoreShape | null>(null);

/* ------------------------------------------------------------------ */
/* Demo-mode persistence (localStorage)                                */
/* ------------------------------------------------------------------ */

interface PersistedState {
  me: UserProfile;
  posts: Post[];
  following: string[];
  followers: string[];
  threads: Thread[];
  notifications: AppNotification[];
  settings: Settings;
  sessions: Session[];
}

function defaultState(): PersistedState {
  return {
    me: SAMPLE_USERS[ME_ID],
    posts: SAMPLE_POSTS.map((p) => ({ ...p, comments: [...p.comments], problems: classifyPost(p.text, p.topics) })),
    following: [...SAMPLE_FOLLOWING],
    followers: [...SAMPLE_FOLLOWERS],
    threads: SAMPLE_THREADS.map((t) => ({ ...t, messages: [...t.messages] })),
    notifications: [...SAMPLE_NOTIFICATIONS],
    settings: { ...DEFAULT_SETTINGS },
    sessions: [...SAMPLE_SESSIONS],
  };
}

function profileFromAuthUser(user: { id: string; email?: string; user_metadata?: any }): UserProfile {
  const username = (
    user.user_metadata?.username ||
    user.email?.split('@')[0] ||
    'member'
  ).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'member';

  return {
    id: ME_ID,
    username,
    name: user.user_metadata?.display_name || user.user_metadata?.full_name || username,
    avatar: null,
    avatarHue: 152,
    cover: null,
    bio: '',
    location: '',
    website: '',
    joined: new Date().toISOString(),
    verified: false,
    persona: false,
  };
}

function loadPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 2) return null;
    const base = defaultState();
    return {
      me: { ...base.me, ...parsed.me },
      posts: Array.isArray(parsed.posts) && parsed.posts.length ? parsed.posts : base.posts,
      following: Array.isArray(parsed.following) ? parsed.following : base.following,
      followers: Array.isArray(parsed.followers) ? parsed.followers : base.followers,
      threads: Array.isArray(parsed.threads) ? parsed.threads : base.threads,
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : base.notifications,
      settings: { ...base.settings, ...parsed.settings },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : base.sessions,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(defaultState, []);
  const [hydrated, setHydrated] = useState(false);
  const [dataMode, setDataMode] = useState<DataMode>('demo');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [me, setMe] = useState<UserProfile>(initial.me);
  const [users, setUsers] = useState<Record<string, UserProfile>>(SAMPLE_USERS);
  const [posts, setPosts] = useState<Post[]>(initial.posts);
  const [following, setFollowing] = useState<string[]>(initial.following);
  const [followers, setFollowers] = useState<string[]>(initial.followers);
  const [threads, setThreads] = useState<Thread[]>(initial.threads);
  const [notifications, setNotifications] = useState<AppNotification[]>(initial.notifications);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [sessions] = useState<Session[]>(initial.sessions);
  const [typing, setTypingMap] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [rankVersion, setRankVersion] = useState(0);

  const tracker = useMemo(() => (typeof window === 'undefined' ? null : getTracker()), []);
  const idsRef = useRef<IdMapper>(new IdMapper(null));
  const profileIdRef = useRef<string | null>(null);
  const channelsRef = useRef<any[]>([]);
  const dmChannelRef = useRef<any>(null);
  const activeThreadRef = useRef<string | null>(null);
  const typingSentAtRef = useRef<Record<string, number>>({});
  const typingTimersRef = useRef<Record<string, number>>({});
  const replyTimers = useRef<number[]>([]);
  const modeRef = useRef<DataMode>('demo');
  const settingsRef = useRef<Settings>(initial.settings);
  const usersRef = useRef(users);
  const pendingMsgsRef = useRef<Set<string>>(new Set());

  modeRef.current = dataMode;
  settingsRef.current = settings;
  usersRef.current = users;

  /* ----------------------------- toasts ----------------------------- */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: Toast['type'] = 'success') => {
      const id = uid('toast-');
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      const timer = window.setTimeout(() => dismissToast(id), 3800);
      replyTimers.current.push(timer);
    },
    [dismissToast]
  );

  /* --------------------------- recsys rank -------------------------- */
  useEffect(() => {
    if (!tracker) return;
    return tracker.subscribe(() => setRankVersion((v) => v + 1));
  }, [tracker]);

  /* ----------------------------- helpers ---------------------------- */
  const getUser = useCallback(
    (id: string): UserProfile =>
      usersRef.current[id] ??
      (id === ME_ID ? me : SAMPLE_USERS[id] ?? { ...usersRef.current[ME_ID] ?? me, id, name: 'Ruhiz member', username: 'member', persona: false }),
    [me]
  );

  const isFollowing = useCallback((id: string) => following.includes(id), [following]);

  /* =========================== BOOTSTRAP =========================== */
  useEffect(() => {
    let cancelled = false;

    // 1) instant demo hydration (also used by pending-migration mode)
    const saved = loadPersisted();
    if (saved) {
      setMe(saved.me);
      setPosts(saved.posts);
      setFollowing(saved.following);
      setFollowers(saved.followers);
      setThreads(saved.threads);
      setNotifications(saved.notifications);
      setSettings(saved.settings);
      setSessionsPrev(saved.sessions);
    }

    // 2) Supabase bootstrap
    if (isSupabaseConfigured && tracker) {
      (async () => {
        console.log('[Ruhiz] Starting Supabase bootstrap...');
        const sb = safeClient();
        console.log('[Ruhiz] Got Supabase client:', !!sb);
        if (!sb || cancelled) return;
        let signedInUser: any = null;
        try {
          console.log('[Ruhiz] Getting auth session...');
          const { data } = await sb.auth.getSession();
          const user = data?.session?.user;
          console.log('[Ruhiz] User from session:', user ? { id: user.id, email: user.email } : null);
          if (!user) {
            finishDemo(null);
            return;
          }
          signedInUser = user;
          setAuthEmail(user.email ?? null);
          setAuthUserId(user.id);

          console.log('[Ruhiz] Ensuring profile exists...');
          const profile = await ensureProfile(sb, user);
          console.log('[Ruhiz] Profile:', profile ? { id: profile.id, username: profile.username } : null);
          if (cancelled) return;
          profileIdRef.current = profile.id;
          idsRef.current = new IdMapper(profile.id);

          await loadProduction(sb, profile, user);
          console.log('[Ruhiz] Production data loaded successfully!');
        } catch (err: any) {
          console.error('[Ruhiz] Production bootstrap failed (raw error):', err);
          console.error('[Ruhiz] Error type:', typeof err);
          console.error('[Ruhiz] Error constructor:', err?.constructor?.name);
          console.error('[Ruhiz] Error string:', String(err));
          console.error('[Ruhiz] Error JSON:', JSON.stringify(err, null, 2));
          console.error('[Ruhiz] Error details:', {
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint,
            statusCode: err?.statusCode,
          });
          const missing = isMissingSchema(err);
          if (signedInUser) {
            finishAuthenticatedError(signedInUser, err, missing);
          } else {
            finishDemo(authEmailRef.current ?? null);
          }
        }
      })();
    } else {
      finishDemo(null);
    }

    function setSessionsPrev(_s: Session[]) {
      /* sessions stay sample-based; kept for API compatibility */
    }

    function finishDemo(email: string | null, pending = false) {
      if (cancelled) return;
      setAuthEmail(email);
      setAuthError(null);
      setDataMode(pending ? 'supabase-pending-migration' : 'demo');
      tracker?.configure({ enabled: false, meId: ME_ID });
      setHydrated(true);
    }

    function finishAuthenticatedError(user: any, err: any, pending = false) {
      if (cancelled) return;
      const fallbackMe = profileFromAuthUser(user);
      const message = err?.message || err?.details || 'Ruhiz could not load your authenticated data.';
      setAuthEmail(user.email ?? null);
      setAuthUserId(user.id);
      setAuthError(
        pending
          ? `Ruhiz is signed in, but the Supabase production schema is not ready: ${message}`
          : `Ruhiz is signed in, but your live profile/feed could not be loaded: ${message}`
      );
      setMe(fallbackMe);
      setUsers({ [ME_ID]: fallbackMe });
      setPosts([]);
      setFollowing([]);
      setFollowers([]);
      setThreads([]);
      setNotifications([]);
      profileIdRef.current = null;
      idsRef.current = new IdMapper(null);
      setDataMode(pending ? 'supabase-pending-migration' : 'supabase-error');
      tracker?.configure({ enabled: false, meId: ME_ID });
      setHydrated(true);
    }

    async function loadProduction(sb: any, profile: any, user: any) {
      const ids = idsRef.current;

      console.log('[Ruhiz] Loading production data for profile:', profile.id);

      // ---- profiles (personas + everybody relevant) ----
      console.log('[Ruhiz] Fetching all profiles...');
      const { data: profileRows, error: profileErr } = await sb.from('profiles').select('*');
      if (profileErr) {
        console.error('[Ruhiz] Profile fetch error:', profileErr);
        throw profileErr;
      }
      console.log('[Ruhiz] Loaded', profileRows?.length || 0, 'profiles');

      const usersMap: Record<string, UserProfile> = { ...SAMPLE_USERS };
      for (const row of profileRows ?? []) {
        const mapped = mapProfile(row, ids);
        usersMap[mapped.id] = mapped;
        if (!row.user_id) ids.register(row.id, row.id); // personas keep their profile id
      }
      const meProfile = mapProfile(profile, ids);
      usersMap[ME_APP_ID_CONST] = meProfile;

      // ---- posts + related ----
      console.log('[Ruhiz] Fetching posts...');
      const { data: postRows, error: postErr } = await sb
        .from('posts')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
        .limit(300);
      if (postErr) {
        console.error('[Ruhiz] Posts fetch error:', postErr);
        throw postErr;
      }
      console.log('[Ruhiz] Loaded', postRows?.length || 0, 'posts');
      const postIds = (postRows ?? []).map((p: any) => p.id as string);

      const [problemRows, supportRows, saveRows, beenRows, commentRows, supporterRows] = (await Promise.all([
        postIds.length ? safeAll(sb.from('post_problems').select('post_id, problem_id, score').in('post_id', postIds)) : Promise.resolve({ data: [] }),
        safeAll(sb.from('post_supports').select('post_id').eq('user_id', profile.id)),
        safeAll(sb.from('post_saves').select('post_id').eq('user_id', profile.id)),
        safeAll(sb.from('been_there').select('post_id').eq('user_id', profile.id)),
        postIds.length ? safeAll(sb.from('comments').select('*').in('post_id', postIds).order('created_at', { ascending: true })) : Promise.resolve({ data: [] }),
        safeAll(sb.from('supporters').select('*').or(`supporter_id.eq.${profile.id},supported_id.eq.${profile.id}`)),
      ])) as any[];

      const problemsByPost = new Map<string, { id: string; score: number }[]>();
      for (const row of problemRows?.data ?? []) {
        const list = problemsByPost.get(row.post_id) ?? [];
        list.push({ id: row.problem_id, score: row.score });
        problemsByPost.set(row.post_id, list);
      }
      const mySupports = new Set((supportRows?.data ?? []).map((r: any) => r.post_id));
      const mySaves = new Set((saveRows?.data ?? []).map((r: any) => r.post_id));
      const myBeenThere = new Set((beenRows?.data ?? []).map((r: any) => r.post_id));

      const commentsByPost = new Map<string, any[]>();
      for (const row of commentRows?.data ?? []) {
        const list = commentsByPost.get(row.post_id) ?? [];
        list.push(row);
        commentsByPost.set(row.post_id, list);
      }

      const mappedPosts: Post[] = (postRows ?? []).map((row: any) =>
        mapPost(row, {
          ids,
          problems: (problemsByPost.get(row.id) ?? []).sort((a, b) => b.score - a.score),
          supportedByMe: mySupports.has(row.id),
          savedByMe: mySaves.has(row.id),
          beenThere: myBeenThere.has(row.id),
          comments: (commentsByPost.get(row.id) ?? []).map((c) => mapComment(c, ids)),
        })
      );

      // ---- social graph ----
      const followingApp: string[] = [];
      const followersApp: string[] = [];
      for (const row of supporterRows?.data ?? []) {
        if (row.supporter_id === profile.id) followingApp.push(ids.app(row.supported_id));
        else followersApp.push(ids.app(row.supporter_id));
      }

      // ---- conversations ----
      const convoBundles = await loadConversations(sb, profile.id);
      const mappedThreads: Thread[] = convoBundles.map((b) => ({
        ...b.thread,
        userId: ids.app(b.otherProfileId),
        online: false,
      }));

      // ---- notifications ----
      const { data: notifRows, error: notifErr } = await sb
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (notifErr) throw notifErr;
      const mappedNotifications = (notifRows ?? []).map((r: any) => mapNotification(r, ids));

      // ---- interest scores from the server ----
      const { data: scoreRows, error: scoreErr } = await sb.rpc('get_user_problem_scores');
      if (scoreErr) throw scoreErr;
      const serverScores: Record<string, number> = {};
      let interactionTotal = 0;
      for (const row of scoreRows ?? []) {
        serverScores[row.problem_id] = row.score;
        interactionTotal += row.interactions ?? 0;
      }

      if (cancelled) return;

      setUsers(usersMap);
      usersRef.current = usersMap;
      setPosts(mappedPosts);
      setFollowing(followingApp);
      setFollowers(followersApp);
      setThreads(mappedThreads);
      setNotifications(mappedNotifications);
      setMe(meProfile);
      setAuthError(null);
      tracker!.configure({
        enabled: true,
        meId: ME_APP_ID_CONST,
        profileId: profile.id,
        interest: { ...tracker!.interest, scores: serverScores, interactionCount: Math.max(interactionTotal, tracker!.interest.interactionCount) },
      });

      setDataMode('supabase');
      setHydrated(true);
      subscribeRealtime(sb, profile.id);
    }

    function subscribeRealtime(sb: any, myProfileId: string) {
      teardownChannels();

      const notifCh = sb
        .channel('ruhiz:notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${myProfileId}` },
          (payload: any) => {
            const n = mapNotification(payload.new, idsRef.current);
            setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
            const actor = usersRef.current[n.actorId]?.name ?? 'Someone';
            const verb =
              n.kind === 'support' ? 'supported your post 💚' :
              n.kind === 'comment' ? 'commented on your post' :
              n.kind === 'person_support' ? 'now supports you' :
              n.kind === 'mention' ? 'mentioned you' :
              'sent you a message';
            toast(`${actor} ${verb}`, 'info');
          }
        )
        .subscribe();

      const messageCh = sb
        .channel('ruhiz:messages')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload: any) => handleIncomingMessage(payload.new)
        )
        .subscribe();

      const participantCh = sb
        .channel('ruhiz:participants')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversation_participants' },
          (payload: any) => {
            const row = payload.new;
            if (row.user_id === myProfileId) return;
            setThreads((prev) =>
              prev.map((t) => (t.id === row.conversation_id ? { ...t, otherLastReadAt: row.last_read_at } : t))
            );
          }
        )
        .subscribe();

      const presenceCh = sb.channel('ruhiz:online', { config: { presence: { key: myProfileId } } });
      presenceCh
        .on('presence', { event: 'sync' }, () => {
          const state = presenceCh.presenceState();
          const ids = Object.keys(state).map((pid) => idsRef.current.app(pid));
          setOnlineIds(ids);
          setThreads((prev) => prev.map((t) => ({ ...t, online: ids.includes(t.userId) })));
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            presenceCh.track({ online_at: new Date().toISOString() });
          }
        });

      channelsRef.current = [notifCh, messageCh, participantCh, presenceCh];
    }

    function handleIncomingMessage(row: any) {
      const myId = profileIdRef.current;
      if (!myId) return;
      const isMe = row.sender_id === myId;
      const senderAppId = idsRef.current.app(row.sender_id);
      const senderIsPersona = usersRef.current[senderAppId]?.persona ?? false;

      const applyMessage = () => {
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== row.conversation_id) return t;
            if (t.messages.some((m) => m.id === row.id)) return t;
            // drop optimistic duplicate
            const messages = [
              ...t.messages.filter((m) => !(m.pending && isMe && m.text === row.content)),
              { id: row.id, fromMe: isMe, text: row.content, at: row.created_at },
            ];
            return {
              ...t,
              messages,
              lastMessageAt: row.created_at,
              unread: isMe || activeThreadRef.current === t.id ? t.unread : t.unread + 1,
            };
          })
        );
        pendingMsgsRef.current.delete(`${row.conversation_id}:${row.content}`);
      };

      if (isMe) {
        applyMessage();
        return;
      }

      // persona replies get a human-feeling delay with a typing indicator
      if (senderIsPersona) {
        setTypingMap((prev) => ({ ...prev, [row.conversation_id]: true }));
        const timer = window.setTimeout(
          () => {
            setTypingMap((prev) => ({ ...prev, [row.conversation_id]: false }));
            applyMessage();
            if (activeThreadRef.current === row.conversation_id && document.visibilityState === 'visible') {
              void markConversationRead(row.conversation_id);
            }
          },
          1100 + Math.random() * 900
        );
        replyTimers.current.push(timer);
      } else {
        applyMessage();
        if (activeThreadRef.current === row.conversation_id && document.visibilityState === 'visible') {
          void markConversationRead(row.conversation_id);
        } else {
          const actor = usersRef.current[senderAppId]?.name ?? 'Someone';
          if (settingsRef.current.notifMessages) toast(`💬 ${actor}: ${String(row.content).slice(0, 60)}`, 'info');
        }
      }
    }

    async function markConversationRead(conversationId: string) {
      setThreads((prev) => prev.map((t) => (t.id === conversationId ? { ...t, unread: 0 } : t)));
      if (modeRef.current !== 'supabase') return;
      const sb = safeClient();
      if (!sb || !profileIdRef.current) return;
      await Promise.resolve(sb.rpc('mark_conversation_read', { p_conversation: conversationId })).catch(() => {});
    }

    function teardownChannels() {
      const sb = safeClient();
      for (const ch of channelsRef.current) {
        try {
          sb?.removeChannel(ch);
        } catch { /* noop */ }
      }
      channelsRef.current = [];
      if (dmChannelRef.current) {
        try {
          safeClient()?.removeChannel(dmChannelRef.current);
        } catch { /* noop */ }
        dmChannelRef.current = null;
      }
    }

    // auth listener
    let authSub: any = null;
    if (isSupabaseConfigured) {
      const sb = safeClient();
      authSub = sb?.auth.onAuthStateChange((event: string) => {
        if (event === 'SIGNED_OUT') {
          teardownChannels();
          profileIdRef.current = null;
          idsRef.current = new IdMapper(null);
          const fresh = defaultState();
          setMe(fresh.me);
          setPosts(fresh.posts);
          setFollowing(fresh.following);
          setFollowers(fresh.followers);
          setThreads(fresh.threads);
          setNotifications(fresh.notifications);
          setUsers(SAMPLE_USERS);
          setAuthEmail(null);
          setAuthUserId(null);
          setAuthError(null);
          setDataMode('demo');
          tracker?.configure({ enabled: false, meId: ME_ID });
        }
      });
    }

    // authEmail may be set by the async bootstrap; capture for finishDemo
    authEmailRef.current = null;

    return () => {
      cancelled = true;
      teardownChannels();
      authSub?.data?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authEmailRef = useRef<string | null>(null);

  useEffect(() => {
    if (authEmail) authEmailRef.current = authEmail;
  }, [authEmail]);

  /* --------------------------- persistence -------------------------- */
  useEffect(() => {
    if (!hydrated || dataMode !== 'demo') return;
    try {
      const payload: PersistedState & { v: number } = {
        v: 2,
        me,
        posts,
        following,
        followers,
        threads,
        notifications,
        settings,
        sessions,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* storage full (big media) — app keeps working in memory */
    }
  }, [hydrated, dataMode, me, posts, following, followers, threads, notifications, settings, sessions]);

  /* ------------------------- theme & appearance ---------------------- */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    root.dataset.fontsize = settings.fontSize;
    root.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme, settings.fontSize, settings.reduceMotion]);

  useEffect(() => {
    const timers = replyTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  /* --------------------------- derived feed -------------------------- */
  const ranked = useMemo<RankedPost[]>(() => {
    if (!tracker) return posts.map((post) => ({ post, score: 0, reason: '', exploration: 0 }));
    return rankFeed(posts, {
      userId: me.id,
      interest: tracker.interest,
      seenAt: tracker.seenAt,
      following,
      hiddenPosts: tracker.hiddenPosts,
      blockedAuthors: settings.blocked,
      notInterestedProblems: tracker.notInterestedProblems,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, following, settings.blocked, me.id, rankVersion, tracker, dataMode, hydrated]);

  const feedReasons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of ranked) map[r.post.id] = r.reason;
    return map;
  }, [ranked]);

  /* ------------------------------ posts ------------------------------ */
  const createPost = useCallback(
    async (input: CreatePostInput): Promise<Post> => {
      if (modeRef.current !== 'supabase' && modeRef.current !== 'demo') {
        toast('Live Ruhiz data is unavailable. Please retry after the database issue is fixed.', 'error');
        throw new Error('Live Ruhiz data is unavailable');
      }

      const problems = classifyPost(input.text, input.topics);
      const optimistic: Post = {
        id: uid('local-'),
        userId: ME_ID,
        type: input.type,
        text: input.text,
        image: input.image,
        video: input.video,
        topics: input.topics,
        problems,
        createdAt: new Date().toISOString(),
        supports: 0,
        shares: 0,
        comments: [],
        commentCount: 0,
        supportedByMe: false,
        savedByMe: false,
        beenThere: false,
        beenThereCount: 0,
        views: 0,
      };
      setPosts((prev) => [optimistic, ...prev]);

      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        console.log('[POST INSERT] Starting insert:', { 
          profileId, 
          hasClient: !!sb, 
          type: input.type,
          textLength: input.text.length,
          hasImage: !!input.image,
          hasVideo: !!input.video,
          topics: input.topics
        });
        
        if (!sb || !profileId) {
          console.error('[POST INSERT] Missing requirements:', { hasClient: !!sb, profileId });
          setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
          toast('Your Ruhiz session is missing a live profile. Please log in again.', 'error');
          throw new Error('Missing live Ruhiz profile');
        }
        if (sb && profileId) {
          const insertPayload = {
            user_id: profileId,
            type: input.type,
            content: input.text,
            image_url: input.image ?? null,
            video_url: input.video ?? null,
            topics: input.topics,
          };
          console.log('[POST INSERT] Insert payload:', insertPayload);
          
          const { data, error } = await sb
            .from('posts')
            .insert(insertPayload)
            .select('*')
            .single();
          
          console.log('[POST INSERT] Result:', { 
            success: !error, 
            data, 
            error: error ? { 
              message: error.message, 
              code: error.code, 
              details: error.details,
              hint: error.hint 
            } : null 
          });
          
          if (!error && data) {
            const { data: probs } = await sb
              .from('post_problems')
              .select('problem_id, score')
              .eq('post_id', data.id);
            const real = mapPost(data, {
              ids: idsRef.current,
              problems: (probs ?? []).map((p: any) => ({ id: p.problem_id, score: p.score })).sort((a: any, b: any) => b.score - a.score),
              supportedByMe: false,
              savedByMe: false,
              beenThere: false,
              comments: [],
            });
            setPosts((prev) => prev.map((p) => (p.id === optimistic.id ? real : p)));
            return real;
          }
          setPosts((prev) => prev.filter((p) => p.id !== optimistic.id));
          // Postgrest errors are plain objects, not Error instances — wrap so the
          // composer shows ONE accurate toast instead of a generic duplicate, and
          // log the raw DB error (code/message/details) for debugging.
          console.error('[Ruhiz] createPost insert failed:', error);
          // The raw database message goes to the console only; members get copy
          // that says what to do rather than exposing internals.
          throw new Error('Your post could not be saved to Ruhiz. Please check your connection and try again.');
        }
      }
      return optimistic;
    },
    [toast]
  );

  const updatePost = useCallback(async (id: string, patch: Partial<Pick<Post, 'text' | 'topics'>>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    if (modeRef.current === 'supabase') {
      const sb = safeClient();
      if (sb) {
        try {
          const { error } = await sb.from('posts').update({ content: patch.text, topics: patch.topics }).eq('id', id);
          if (!error) {
            const { data: probs } = await sb.from('post_problems').select('problem_id, score').eq('post_id', id);
            setPosts((prev) =>
              prev.map((p) =>
                p.id === id
                  ? { ...p, problems: (probs ?? []).map((x: any) => ({ id: x.problem_id, score: x.score })) }
                  : p
              )
            );
          }
        } catch { /* offline — optimistic state already applied */ }
      }
    }
  }, []);

  const deletePost = useCallback(async (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (modeRef.current === 'supabase') {
      const sb = safeClient();
      fire(sb?.from('posts').delete().eq('id', id));
    }
  }, []);

  /** Re-fetch posts + related state from Supabase (feed refresh button). */
  const refreshPosts = useCallback(async () => {
    if (modeRef.current !== 'supabase') return;
    const sb = safeClient();
    const profileId = profileIdRef.current;
    if (!sb || !profileId) return;
    try {
      const { data: postRows, error } = await sb
        .from('posts')
        .select('*')
        .eq('status', 'live')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error || !postRows) return;
      const postIds = postRows.map((p: any) => p.id as string);
      const [problemRows, supportRows, saveRows, beenRows, commentRows] = (await Promise.all([
        postIds.length ? sb.from('post_problems').select('post_id, problem_id, score').in('post_id', postIds) : Promise.resolve({ data: [] }),
        sb.from('post_supports').select('post_id').eq('user_id', profileId),
        sb.from('post_saves').select('post_id').eq('user_id', profileId),
        sb.from('been_there').select('post_id').eq('user_id', profileId),
        postIds.length ? sb.from('comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      ])) as any[];

      const problemsByPost = new Map<string, { id: string; score: number }[]>();
      for (const row of problemRows?.data ?? []) {
        const list = problemsByPost.get(row.post_id) ?? [];
        list.push({ id: row.problem_id, score: row.score });
        problemsByPost.set(row.post_id, list);
      }
      const mySupports = new Set((supportRows?.data ?? []).map((r: any) => r.post_id));
      const mySaves = new Set((saveRows?.data ?? []).map((r: any) => r.post_id));
      const myBeenThere = new Set((beenRows?.data ?? []).map((r: any) => r.post_id));
      const commentsByPost = new Map<string, any[]>();
      for (const row of commentRows?.data ?? []) {
        const list = commentsByPost.get(row.post_id) ?? [];
        list.push(row);
        commentsByPost.set(row.post_id, list);
      }

      // pick up any new authors so names/avatars resolve
      const authorIds = [...new Set(postRows.map((p: any) => p.user_id as string))];
      if (authorIds.length) {
        const { data: authorRows } = await sb.from('profiles').select('*').in('id', authorIds);
        setUsers((prev) => {
          const next = { ...prev };
          for (const row of authorRows ?? []) {
            const mapped = mapProfile(row, idsRef.current);
            next[mapped.id] = mapped;
            if (!row.user_id) idsRef.current.register(row.id, row.id);
          }
          usersRef.current = next;
          return next;
        });
      }

      setPosts(
        postRows.map((row: any) =>
          mapPost(row, {
            ids: idsRef.current,
            problems: (problemsByPost.get(row.id) ?? []).sort((a, b) => b.score - a.score),
            supportedByMe: mySupports.has(row.id),
            savedByMe: mySaves.has(row.id),
            beenThere: myBeenThere.has(row.id),
            comments: (commentsByPost.get(row.id) ?? []).map((c) => mapComment(c, idsRef.current)),
          })
        )
      );
    } catch (err) {
      console.warn('[ruhiz] refresh failed:', err);
    }
  }, []);

  const toggleSupport = useCallback(
    (id: string) => {
      let nowSupporting = false;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          nowSupporting = !p.supportedByMe;
          return { ...p, supportedByMe: nowSupporting, supports: p.supports + (nowSupporting ? 1 : -1) };
        })
      );
      const post = posts.find((p) => p.id === id);
      if (nowSupporting && post) tracker?.track('support', { post });
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        if (sb && profileId && !id.startsWith('local-')) {
          if (nowSupporting) fire(sb.from('post_supports').insert({ post_id: id, user_id: profileId }));
          else fire(sb.from('post_supports').delete().eq('post_id', id).eq('user_id', profileId));
        }
      }
    },
    [posts, tracker]
  );

  const toggleSave = useCallback(
    (id: string) => {
      let nowSaving = false;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          nowSaving = !p.savedByMe;
          return { ...p, savedByMe: nowSaving, ...(!nowSaving ? {} : {}) };
        })
      );
      const post = posts.find((p) => p.id === id);
      if (nowSaving && post) tracker?.track('save', { post });
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        if (sb && profileId && !id.startsWith('local-')) {
          if (nowSaving) fire(sb.from('post_saves').insert({ post_id: id, user_id: profileId }));
          else fire(sb.from('post_saves').delete().eq('post_id', id).eq('user_id', profileId));
        }
      }
    },
    [posts, tracker]
  );

  const toggleBeenThere = useCallback(
    (id: string) => {
      let nowMarked = false;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          nowMarked = !p.beenThere;
          return { ...p, beenThere: nowMarked, beenThereCount: p.beenThereCount + (nowMarked ? 1 : -1) };
        })
      );
      const post = posts.find((p) => p.id === id);
      if (nowMarked && post) tracker?.track('been_there', { post });
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        if (sb && profileId && !id.startsWith('local-')) {
          if (nowMarked) fire(sb.from('been_there').insert({ post_id: id, user_id: profileId }));
          else fire(sb.from('been_there').delete().eq('post_id', id).eq('user_id', profileId));
        }
      }
    },
    [posts, tracker]
  );

  const addComment = useCallback(
    (postId: string, text: string) => {
      const comment = { id: uid('c-'), userId: ME_ID, text, createdAt: new Date().toISOString() };
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: [...p.comments, comment], commentCount: p.commentCount + 1 } : p
        )
      );
      const post = posts.find((p) => p.id === postId);
      if (post) tracker?.track('comment', { post });
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        if (sb && profileId && !postId.startsWith('local-')) {
          sb.from('comments')
            .insert({ post_id: postId, user_id: profileId, content: text })
            .then(({ data, error }: any) => {
              if (!error && data) {
                const mapped = mapComment(data, idsRef.current);
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === postId
                      ? { ...p, comments: p.comments.map((c) => (c.id === comment.id ? mapped : c)) }
                      : p
                  )
                );
              }
            });
        }
      }
    },
    [posts, tracker]
  );

  const sharePost = useCallback(
    (postId: string, threadId?: string) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, shares: p.shares + 1 } : p)));
      const post = posts.find((p) => p.id === postId);
      if (post) tracker?.track('share', { post });
      if (threadId) {
        const author = getUser(post?.userId ?? '');
        const note = `Sharing a moment from ${author.name}: “${(post?.text ?? '').slice(0, 120)}${(post?.text ?? '').length > 120 ? '…' : ''}”`;
        void sendMessage(threadId, note);
      } else if (modeRef.current === 'supabase' && post) {
        tracker?.flush(); // ensure the share activity ships
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, getUser]
  );

  /* ----------------------------- people ------------------------------- */
  const toggleFollow = useCallback(
    (userId: string) => {
      let nowFollowing = false;
      setFollowing((prev) => {
        nowFollowing = !prev.includes(userId);
        return nowFollowing ? [...prev, userId] : prev.filter((id) => id !== userId);
      });
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        const targetProfile = idsRef.current.profile(userId);
        if (sb && profileId && targetProfile) {
          if (nowFollowing)
            fire(sb.from('supporters').insert({ supporter_id: profileId, supported_id: targetProfile }));
          else
            fire(sb.from('supporters').delete().eq('supporter_id', profileId).eq('supported_id', targetProfile));
        }
      }
    },
    []
  );

  const removeFollower = useCallback((userId: string) => {
    setFollowers((prev) => prev.filter((id) => id !== userId));
    if (modeRef.current === 'supabase') {
      const sb = safeClient();
      const profileId = profileIdRef.current;
      const targetProfile = idsRef.current.profile(userId);
      fire(sb?.from('supporters').delete().eq('supporter_id', targetProfile).eq('supported_id', profileId));
    }
  }, []);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    setMe((prev) => ({ ...prev, ...patch }));
    if (modeRef.current === 'supabase') {
      const sb = safeClient();
      const columnPatch: Record<string, unknown> = {};
      if (patch.username !== undefined) columnPatch.username = patch.username;
      if (patch.name !== undefined) columnPatch.display_name = patch.name;
      if (patch.bio !== undefined) columnPatch.bio = patch.bio;
      if (patch.location !== undefined) columnPatch.location = patch.location;
      if (patch.website !== undefined) columnPatch.website = patch.website;
      if (patch.avatar !== undefined) columnPatch.avatar_url = patch.avatar;
      if (patch.cover !== undefined) columnPatch.cover_url = patch.cover;
      if (patch.avatarHue !== undefined) columnPatch.avatar_hue = patch.avatarHue;
      if (Object.keys(columnPatch).length && sb) {
        fire(sb.from('profiles').update(columnPatch).eq('id', profileIdRef.current));
      }
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (modeRef.current === 'supabase') {
          const sb = safeClient();
          fire(sb?.from('profiles').update({ settings: next }).eq('id', profileIdRef.current));
        }
        return next;
      });
    },
    []
  );

  /* ----------------------------- messaging ---------------------------- */
  const openThreadWith = useCallback(
    async (userId: string): Promise<string> => {
      const existing = threads.find((t) => t.userId === userId);
      if (existing) return existing.id;

      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const targetProfile = idsRef.current.profile(userId);
        if (sb && targetProfile) {
          const { data, error } = await sb.rpc('get_or_create_conversation', { p_other: targetProfile });
          if (!error && data) {
            const convoId = data as string;
            setThreads((prev) =>
              prev.some((t) => t.id === convoId)
                ? prev
                : [{ id: convoId, userId, messages: [], unread: 0, online: false, otherLastReadAt: null, lastMessageAt: null }, ...prev]
            );
            return convoId;
          }
        }
      }

      const id = uid('t-');
      setThreads((prev) => [
        { id, userId, messages: [], unread: 0, online: true, otherLastReadAt: null, lastMessageAt: null },
        ...prev,
      ]);
      return id;
    },
    [threads]
  );

  const sendMessage = useCallback(
    async (threadId: string, text: string) => {
      if (modeRef.current === 'supabase') {
        const normalizedText = text.trim();
        if (!normalizedText || normalizedText.length > 4000) {
          toast('Messages must be between 1 and 4000 characters.', 'error');
          return;
        }

        const tempId = uid('pending-');
        const pendingKey = `${threadId}:${normalizedText}`;
        pendingMsgsRef.current.add(pendingKey);
        const optimisticAt = new Date().toISOString();
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [...t.messages, { id: tempId, fromMe: true, text: normalizedText, at: optimisticAt, pending: true }],
                  lastMessageAt: optimisticAt,
                }
              : t
          )
        );
        const discardOptimistic = () => {
          pendingMsgsRef.current.delete(pendingKey);
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== threadId) return t;
              const messages = t.messages.filter((m) => m.id !== tempId);
              return { ...t, messages, lastMessageAt: messages.at(-1)?.at ?? null };
            })
          );
        };

        const sb = safeClient();
        if (!sb) {
          discardOptimistic();
          toast('Your Ruhiz session is not connected to Supabase.', 'error');
          return;
        }

        // The database stores profiles.id in messages.sender_id. Resolve that
        // value from the current Supabase Auth user for every send; never use a
        // username, demo id, or stale UI identity as the sender.
        const {
          data: { user },
          error: authError,
        } = await sb.auth.getUser();
        if (authError || !user) {
          discardOptimistic();
          console.warn('[ruhiz] message auth lookup failed:', authError?.message ?? 'No authenticated user');
          toast('Your Ruhiz session expired. Please log in again.', 'error');
          return;
        }

        const { data: senderProfile, error: profileError } = await sb
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        const senderProfileId = senderProfile?.id as string | undefined;
        if (profileError || !senderProfileId) {
          discardOptimistic();
          console.warn('[ruhiz] message profile lookup failed:', profileError?.message ?? 'No profile for authenticated user');
          toast('Your Ruhiz profile is unavailable. Please log in again.', 'error');
          return;
        }
        profileIdRef.current = senderProfileId;

        const { data, error } = await sb
          .from('messages')
          .insert({ conversation_id: threadId, sender_id: senderProfileId, content: normalizedText })
          .select('*')
          .single();
        console.log('[DEBUG] Message INSERT:', { threadId, senderProfileId, content: normalizedText, data, error });
        if (error || !data) {
          discardOptimistic();
          console.warn('[ruhiz] message failed:', error?.message ?? 'No message row returned');
          toast('Message failed to send. Check your connection.', 'error');
          return;
        }
        console.log('[DEBUG] Message saved successfully:', data.id);
        // Reconcile the optimistic row with the persisted row. The postgres_changes
        // echo is deduplicated by id in handleIncomingMessage.
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === tempId ? { id: data.id, fromMe: true, text: data.content ?? normalizedText, at: data.created_at } : m
                  ),
                  lastMessageAt: data.created_at,
                }
              : t
          )
        );
        pendingMsgsRef.current.delete(pendingKey);
        return;
      }

      // demo mode — canned replies keep the conversation alive
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, messages: [...t.messages, { id: uid('m-'), fromMe: true, text, at: new Date().toISOString() }] }
            : t
        )
      );
      setTypingMap((prev) => ({ ...prev, [threadId]: true }));
      const timer = window.setTimeout(
        () => {
          setTypingMap((prev) => ({ ...prev, [threadId]: false }));
          const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
          setThreads((prev) =>
            prev.map((t) =>
              t.id === threadId
                ? { ...t, messages: [...t.messages, { id: uid('m-'), fromMe: false, text: reply, at: new Date().toISOString() }] }
                : t
            )
          );
        },
        1400 + Math.random() * 2200
      );
      replyTimers.current.push(timer);
    },
    [toast]
  );

  const markThreadRead = useCallback((threadId: string) => {
    setThreads((prev) => {
      const t = prev.find((x) => x.id === threadId);
      if (t && t.unread > 0 && modeRef.current === 'supabase') {
        const sb = safeClient();
        fire(sb?.rpc('mark_conversation_read', { p_conversation: threadId }));
      }
      return prev.map((x) => (x.id === threadId ? { ...x, unread: 0 } : x));
    });
  }, []);

  const setActiveThread = useCallback(
    (threadId: string | null) => {
      activeThreadRef.current = threadId;
      // per-conversation private channel for typing broadcast
      if (dmChannelRef.current) {
        try {
          safeClient()?.removeChannel(dmChannelRef.current);
        } catch { /* noop */ }
        dmChannelRef.current = null;
      }
      if (threadId && modeRef.current === 'supabase') {
        const sb = safeClient();
        const profileId = profileIdRef.current;
        if (sb && profileId) {
          const ch = sb.channel(`dm:${threadId}`, { config: { private: true, presence: { key: profileId } } });
          ch.on('broadcast', { event: 'typing' }, ({ payload }: any) => {
            if (payload?.userId === profileId) return;
            if (payload?.typing) {
              setTypingMap((prev) => ({ ...prev, [threadId]: true }));
              window.clearTimeout(typingTimersRef.current[threadId]);
              typingTimersRef.current[threadId] = window.setTimeout(() => {
                setTypingMap((prev) => ({ ...prev, [threadId]: false }));
              }, 3500);
            } else {
              setTypingMap((prev) => ({ ...prev, [threadId]: false }));
            }
          });
          dmChannelRef.current = ch;
          ch.subscribe();
        }
      }
    },
    []
  );

  const sendTyping = useCallback(
    (threadId: string) => {
      if (modeRef.current !== 'supabase') return;
      const now = Date.now();
      const last = typingSentAtRef.current[threadId] ?? 0;
      if (now - last < 2200) return;
      typingSentAtRef.current[threadId] = now;
      dmChannelRef.current?.send?.({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: profileIdRef.current, typing: true },
      });
      window.clearTimeout(typingTimersRef.current[threadId]);
      typingTimersRef.current[threadId] = window.setTimeout(() => {
        dmChannelRef.current?.send?.({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: profileIdRef.current, typing: false },
        });
      }, 3000);
    },
    []
  );

  /* --------------------------- notifications -------------------------- */
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const unread = prev.filter((n) => !n.read);
      if (modeRef.current === 'supabase' && unread.length) {
        const sb = safeClient();
        for (const n of unread) fire(sb?.from('notifications').update({ read: true }).eq('id', n.id));
      }
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (modeRef.current === 'supabase') {
      fire(safeClient()?.from('notifications').update({ read: true }).eq('id', id));
    }
  }, []);

  /* ----------------------------- safety ------------------------------- */
  const blockUser = useCallback(
    (id: string) => {
      setSettings((prev) => ({ ...prev, blocked: [...new Set([...prev.blocked, id])] }));
      setFollowing((prev) => prev.filter((f) => f !== id));
      setFollowers((prev) => prev.filter((f) => f !== id));
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const targetProfile = idsRef.current.profile(id);
        fire(sb?.from('blocks').insert({ blocker_id: profileIdRef.current, blocked_id: targetProfile }));
      }
      const name = usersRef.current[id]?.name ?? 'member';
      toast(`Blocked ${name}`);
    },
    [toast]
  );

  const unblockUser = useCallback(
    (id: string) => {
      setSettings((prev) => ({ ...prev, blocked: prev.blocked.filter((b) => b !== id) }));
      if (modeRef.current === 'supabase') {
        const sb = safeClient();
        const targetProfile = idsRef.current.profile(id);
        fire(sb?.from('blocks').delete().eq('blocker_id', profileIdRef.current).eq('blocked_id', targetProfile));
      }
    },
    []
  );

  const revokeSession = useCallback((id: string) => {
    // sessions list is demo metadata; revoking only affects the local view
    void id;
  }, []);

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* noop */ }
    tracker?.reset();
    const fresh = defaultState();
    if (modeRef.current !== 'supabase') {
      setMe(fresh.me);
      setPosts(fresh.posts);
      setFollowing(fresh.following);
      setFollowers(fresh.followers);
      setThreads(fresh.threads);
      setNotifications(fresh.notifications);
      setSettings(fresh.settings);
    }
  }, [tracker]);

  /* ------------------------------ recsys ------------------------------ */
  const trackActivity = useCallback(
    (action: ActivityAction, opts?: { post?: Post; query?: string; meta?: Record<string, unknown> }) => {
      tracker?.track(action, opts);
      if (action === 'view' && opts?.post) tracker?.markSeen([opts.post.id]);
    },
    [tracker]
  );

  const trackSearch = useCallback(
    (query: string) => {
      if (query.trim().length < 3) return;
      tracker?.track('search', { query });
    },
    [tracker]
  );

  const hidePost = useCallback(
    (postId: string, opts?: { problemId?: string; notInterested?: boolean }) => {
      tracker?.hidePost(postId);
      if (opts?.notInterested && opts.problemId) tracker?.markProblemNotInterested(opts.problemId);
      if (opts?.notInterested && opts.problemId) {
        tracker?.track('not_interested', {});
      } else {
        tracker?.track('ignore', {});
      }
      setPosts((prev) => [...prev]); // trigger re-rank
    },
    [tracker]
  );

  const unreadMessages = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);
  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: StoreShape = {
    hydrated,
    dataMode,
    demoMode: dataMode === 'demo',
    authError,
    authEmail,
    authUserId,
    me,
    users,
    posts,
    rankedFeed: ranked,
    feedReasons,
    interestScores: tracker?.interest.scores ?? {},
    explorationLevel: tracker ? rankExploration(tracker) : 0,
    following,
    followers,
    threads,
    notifications,
    settings,
    sessions,
    typing,
    toasts,
    onlineIds,
    unreadMessages,
    unreadNotifications,
    getUser,
    isFollowing,
    toast,
    dismissToast,
    createPost,
    updatePost,
    deletePost,
    toggleSupport,
    toggleSave,
    toggleBeenThere,
    addComment,
    sharePost,
    toggleFollow,
    removeFollower,
    updateProfile,
    updateSettings,
    sendMessage,
    openThreadWith,
    markThreadRead,
    sendTyping,
    setActiveThread,
    markAllNotificationsRead,
    markNotificationRead,
    blockUser,
    unblockUser,
    revokeSession,
    resetDemo,
    trackActivity,
    trackSearch,
    hidePost,
    refreshPosts,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function rankExploration(tracker: ReturnType<typeof getTracker>): number {
  return explorationLevel(tracker.interest);
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
