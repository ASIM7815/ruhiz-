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
  AppNotification,
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

const STORAGE_KEY = 'ruhiz.app.v1';

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
  demoMode: boolean;
  authEmail: string | null;
  me: UserProfile;
  users: Record<string, UserProfile>;
  posts: Post[];
  following: string[];
  followers: string[];
  threads: Thread[];
  notifications: AppNotification[];
  settings: Settings;
  sessions: Session[];
  typing: Record<string, boolean>;
  toasts: Toast[];
  unreadMessages: number;
  unreadNotifications: number;
  getUser: (id: string) => UserProfile;
  isFollowing: (id: string) => boolean;
  toast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
  createPost: (input: CreatePostInput) => Promise<Post>;
  updatePost: (id: string, patch: Partial<Pick<Post, 'text' | 'topics'>>) => void;
  deletePost: (id: string) => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  toggleBeenThere: (id: string) => void;
  addComment: (postId: string, text: string) => void;
  sharePost: (postId: string, threadId?: string) => void;
  toggleFollow: (userId: string) => void;
  removeFollower: (userId: string) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  sendMessage: (threadId: string, text: string) => void;
  openThreadWith: (userId: string) => string;
  markThreadRead: (threadId: string) => void;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  blockUser: (id: string) => void;
  unblockUser: (id: string) => void;
  revokeSession: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreShape | null>(null);

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
    posts: SAMPLE_POSTS,
    following: [...SAMPLE_FOLLOWING],
    followers: [...SAMPLE_FOLLOWERS],
    threads: SAMPLE_THREADS.map((t) => ({ ...t, messages: [...t.messages] })),
    notifications: [...SAMPLE_NOTIFICATIONS],
    settings: { ...DEFAULT_SETTINGS },
    sessions: [...SAMPLE_SESSIONS],
  };
}

function loadPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(defaultState, []);
  const [hydrated, setHydrated] = useState(false);
  const [me, setMe] = useState<UserProfile>(initial.me);
  const [users] = useState<Record<string, UserProfile>>(SAMPLE_USERS);
  const [posts, setPosts] = useState<Post[]>(initial.posts);
  const [following, setFollowing] = useState<string[]>(initial.following);
  const [followers, setFollowers] = useState<string[]>(initial.followers);
  const [threads, setThreads] = useState<Thread[]>(initial.threads);
  const [notifications, setNotifications] = useState<AppNotification[]>(initial.notifications);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const replyTimers = useRef<number[]>([]);

  /* ----------------------------- hydrate ----------------------------- */
  useEffect(() => {
    const saved = loadPersisted();
    if (saved) {
      setMe(saved.me);
      setPosts(saved.posts);
      setFollowing(saved.following);
      setFollowers(saved.followers);
      setThreads(saved.threads);
      setNotifications(saved.notifications);
      setSettings(saved.settings);
      setSessions(saved.sessions);
    }

    // Supabase session sync (when configured)
    if (isSupabaseConfigured) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createClient } = require('./supabase/client');
        const supabase = createClient();
        supabase.auth
          .getSession()
          .then(({ data }: any) => {
            const u = data?.session?.user;
            if (u) {
              setAuthEmail(u.email ?? null);
              const meta = u.user_metadata ?? {};
              setMe((prev) => ({
                ...prev,
                name: meta.display_name || meta.username ? meta.display_name || prev.name : prev.name,
                username: meta.username || prev.username,
              }));
            }
          })
          .catch(() => {});
      } catch {
        /* supabase unavailable */
      }
    }

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------- persist ----------------------------- */
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedState & { v: number } = {
        v: 1,
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
  }, [hydrated, me, posts, following, followers, threads, notifications, settings, sessions]);

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

  /* ------------------------------ toasts ----------------------------- */
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

  /* ------------------------------ helpers ---------------------------- */
  const getUser = useCallback(
    (id: string): UserProfile => users[id] ?? (id === ME_ID ? me : SAMPLE_USERS[id] ?? { ...users[ME_ID], id, name: 'Ruhiz member', username: 'member' }),
    [users, me]
  );

  const isFollowing = useCallback((id: string) => following.includes(id), [following]);

  /* ------------------------------- posts ------------------------------ */
  const createPost = useCallback(
    async (input: CreatePostInput): Promise<Post> => {
      const post: Post = {
        id: uid('p-'),
        userId: ME_ID,
        type: input.type,
        text: input.text,
        image: input.image,
        video: input.video,
        topics: input.topics,
        createdAt: new Date().toISOString(),
        likes: 0,
        shares: 0,
        comments: [],
        likedByMe: false,
        savedByMe: false,
        beenThere: false,
        beenThereCount: 0,
      };
      setPosts((prev) => [post, ...prev]);

      // Supabase + R2 persistence when configured
      if (isSupabaseConfigured) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { createClient } = require('./supabase/client');
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('moments').insert({
              user_id: user.id,
              content: post.text,
              image_url: post.image ?? null,
              video_url: post.video ?? null,
              topics: post.topics,
            });
          }
        } catch {
          /* remote sync is best-effort */
        }
      }
      return post;
    },
    []
  );

  const updatePost = useCallback((id: string, patch: Partial<Pick<Post, 'text' | 'topics'>>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deletePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleLike = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) }
          : p
      )
    );
  }, []);

  const toggleSave = useCallback((id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, savedByMe: !p.savedByMe } : p)));
  }, []);

  const toggleBeenThere = useCallback((id: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, beenThere: !p.beenThere, beenThereCount: p.beenThereCount + (p.beenThere ? -1 : 1) }
          : p
      )
    );
  }, []);

  const addComment = useCallback(
    (postId: string, text: string) => {
      const comment = { id: uid('c-'), userId: ME_ID, text, createdAt: new Date().toISOString() };
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p)));
    },
    []
  );

  const sharePost = useCallback(
    (postId: string, threadId?: string) => {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, shares: p.shares + 1 } : p)));
      if (threadId) {
        const post = posts.find((p) => p.id === postId);
        if (post) {
          const author = getUser(post.userId);
          const note = `Sharing a moment from ${author.name}: “${post.text.slice(0, 120)}${post.text.length > 120 ? '…' : ''}”`;
          setThreads((prev) =>
            prev.map((t) =>
              t.id === threadId
                ? { ...t, messages: [...t.messages, { id: uid('m-'), fromMe: true, text: note, at: new Date().toISOString() }] }
                : t
            )
          );
        }
      }
    },
    [posts, getUser]
  );

  /* ----------------------------- people ------------------------------- */
  const toggleFollow = useCallback(
    (userId: string) => {
      setFollowing((prev) => {
        const now = prev.includes(userId);
        if (!now) {
          // they may follow back — keep it one-directional, notify only
        }
        return now ? prev.filter((id) => id !== userId) : [...prev, userId];
      });
    },
    []
  );

  const removeFollower = useCallback((userId: string) => {
    setFollowers((prev) => prev.filter((id) => id !== userId));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setMe((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  /* ----------------------------- messaging ---------------------------- */
  const openThreadWith = useCallback(
    (userId: string): string => {
      const existing = threads.find((t) => t.userId === userId);
      if (existing) return existing.id;
      const id = uid('t-');
      setThreads((prev) => [{ id, userId, messages: [], unread: 0, online: true }, ...prev]);
      return id;
    },
    [threads]
  );

  const sendMessage = useCallback(
    (threadId: string, text: string) => {
      const at = new Date().toISOString();
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, messages: [...t.messages, { id: uid('m-'), fromMe: true, text, at }] } : t
        )
      );
      // Simulated reply in demo mode — keeps Messages alive and conversational
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      const delay = 1400 + Math.random() * 2200;
      setTyping((prev) => ({ ...prev, [threadId]: true }));
      const timer = window.setTimeout(() => {
        setTyping((prev) => ({ ...prev, [threadId]: false }));
        const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, { id: uid('m-'), fromMe: false, text: reply, at: new Date().toISOString() }] }
              : t
          )
        );
      }, delay);
      replyTimers.current.push(timer);
      void at;
    },
    [threads]
  );

  const markThreadRead = useCallback((threadId: string) => {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)));
  }, []);

  /* --------------------------- notifications -------------------------- */
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  /* ----------------------------- safety ------------------------------- */
  const blockUser = useCallback(
    (id: string) => {
      setSettings((prev) => ({ ...prev, blocked: [...new Set([...prev.blocked, id])] }));
      setFollowing((prev) => prev.filter((f) => f !== id));
      setFollowers((prev) => prev.filter((f) => f !== id));
    },
    []
  );

  const unblockUser = useCallback((id: string) => {
    setSettings((prev) => ({ ...prev, blocked: prev.blocked.filter((b) => b !== id) }));
  }, []);

  const revokeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const resetDemo = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    const fresh = defaultState();
    setMe(fresh.me);
    setPosts(fresh.posts);
    setFollowing(fresh.following);
    setFollowers(fresh.followers);
    setThreads(fresh.threads);
    setNotifications(fresh.notifications);
    setSettings(fresh.settings);
    setSessions(fresh.sessions);
  }, []);

  const unreadMessages = useMemo(() => threads.reduce((sum, t) => sum + t.unread, 0), [threads]);
  const unreadNotifications = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value: StoreShape = {
    hydrated,
    demoMode: !isSupabaseConfigured,
    authEmail,
    me,
    users,
    posts,
    following,
    followers,
    threads,
    notifications,
    settings,
    sessions,
    typing,
    toasts,
    unreadMessages,
    unreadNotifications,
    getUser,
    isFollowing,
    toast,
    dismissToast,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
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
    markAllNotificationsRead,
    markNotificationRead,
    blockUser,
    unblockUser,
    revokeSession,
    resetDemo,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
