'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppNotification, DataMode, Settings, Thread, UserProfile } from '@/lib/types';
import { uid } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/config';
import { emptyDB, type DuelDB } from './db';
import type { DuelAdapter } from './adapter';
import { getLocalAdapter } from './local';
import { SupabaseAdapter } from './supabase';
import { rankChallenges, trendingCategories, type RankedChallenge } from './recommend';
import type { Category, Challenge, ChallengeComment, ChallengeView, Checkin, CreateChallengeInput, Participation, SearchResults } from './types';
import { ME_APP_ID } from '@/lib/backend/api';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  username: string;
}

interface StoreShape {
  hydrated: boolean;
  dataMode: DataMode;
  authed: boolean;
  authError: string | null;
  db: DuelDB;
  settings: Settings;
  me: UserProfile | null;
  categories: Category[];
  toasts: Toast[];
  toast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;
  getUser: (id: string) => UserProfile;
  getView: (challenge: Challenge) => ChallengeView;
  findById: (id: string) => ChallengeView | undefined;
  recommended: RankedChallenge[];
  recommendedViews: ChallengeView[];
  trending: { categoryId: string; challengeCount: number; participants: number }[];
  myParticipations: Participation[];
  myActive: Participation[];
  myCompleted: Participation[];
  savedViews: ChallengeView[];
  createdViews: ChallengeView[];
  joinedViews: ChallengeView[];
  searchAll: (query: string) => SearchResults;
  unreadNotifications: number;
  unreadMessages: number;
  notifications: AppNotification[];
  threads: Thread[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  demoResetPassword: (email: string, newPassword: string) => Promise<void>;
  createChallenge: (input: CreateChallengeInput) => Promise<Challenge | null>;
  updateChallenge: (id: string, patch: Partial<Challenge>) => Promise<boolean>;
  deleteChallenge: (id: string) => Promise<boolean>;
  joinChallenge: (id: string) => Promise<boolean>;
  leaveChallenge: (id: string) => Promise<boolean>;
  checkin: (challengeId: string, note: string) => Promise<Checkin | null>;
  toggleLike: (id: string) => Promise<boolean>;
  toggleSave: (id: string) => Promise<boolean>;
  shareChallenge: (id: string) => Promise<boolean>;
  addComment: (id: string, text: string) => Promise<boolean>;
  deleteComment: (id: string) => Promise<boolean>;
  viewChallenge: (id: string) => void;
  notInterested: (id: string) => void;
  recordSearch: (q: string) => void;
  openThreadWith: (userId: string) => Promise<string | null>;
  sendMessage: (threadId: string, text: string) => Promise<boolean>;
  markThreadRead: (threadId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateProfile: (patch: Partial<UserProfile>) => Promise<boolean>;
  updateSettings: (patch: Partial<Settings>) => void;
  blockUser: (id: string) => void;
  unblockUser: (id: string) => void;
  resetLocal: () => Promise<void>;
}

const StoreContext = createContext<StoreShape | null>(null);

const FALLBACK_USER: UserProfile = {
  id: 'unknown', username: 'duelist', name: 'DUEL member', avatar: null, avatarHue: 152,
  cover: null, bio: '', location: '', website: '', joined: new Date().toISOString(), verified: false,
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const adapterRef = useRef<DuelAdapter | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = isSupabaseConfigured ? new SupabaseAdapter() : getLocalAdapter();
  }
  const adapter = adapterRef.current;

  const [hydrated, setHydrated] = useState(false);
  const [dataMode, setDataMode] = useState<DataMode>(isSupabaseConfigured ? 'supabase' : 'demo');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [db, setDb] = useState<DuelDB>(emptyDB());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef(db);
  dbRef.current = db;

  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message: string, type: Toast['type'] = 'success') => {
      const id = uid('toast-');
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      window.setTimeout(() => dismissToast(id), 3600);
    },
    [dismissToast]
  );

  /* ------------------------------ bootstrap ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    const unsub = adapter.subscribe((next) => {
      if (!cancelled) setDb(next);
    });
    (async () => {
      try {
        console.log('[BOOTSTRAP] Starting bootstrap...');
        const res = await adapter.bootstrap();
        console.log('[BOOTSTRAP] Result:', { authed: res.authed, error: res.error, meId: res.db.meId });
        if (cancelled) return;
        setDb(res.db);
        setAuthed(res.authed);
        console.log('[BOOTSTRAP] Set authed to:', res.authed);
        if (res.error) setAuthError(res.error);
        if (res.pendingMigration) setDataMode('supabase-pending-migration');
        else setDataMode(isSupabaseConfigured ? 'supabase' : 'demo');
      } catch (err: any) {
        console.error('[BOOTSTRAP] Error:', err);
        if (cancelled) return;
        setAuthError(err?.message ?? 'Could not load DUEL data.');
        if (isSupabaseConfigured) setDataMode('supabase-error');
      } finally {
        if (!cancelled) {
          console.log('[BOOTSTRAP] Setting hydrated to true');
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [adapter]);

  /* --------------------------- theme application ------------------------ */
  useEffect(() => {
    const s = db.settings;
    const root = document.documentElement;
    const applyTheme = (dark: boolean) => root.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (s.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches);
      const onChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    applyTheme(s.theme === 'dark');
  }, [db.settings.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-fontsize', db.settings.fontSize);
  }, [db.settings.fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduce-motion', String(db.settings.reduceMotion));
  }, [db.settings.reduceMotion]);

  /* ------------------------------- selectors ---------------------------- */

  const me = useMemo<UserProfile | null>(() => (db.meId ? db.profiles[db.meId] ?? db.profiles[ME_APP_ID] ?? null : null), [db.meId, db.profiles]);

  const getUser = useCallback(
    (id: string): UserProfile => dbRef.current.profiles[id] ?? (id === ME_APP_ID ? dbRef.current.profiles[dbRef.current.meId ?? ME_APP_ID] : undefined) ?? { ...FALLBACK_USER, id },
    []
  );

  const getView = useCallback((challenge: Challenge): ChallengeView => {
    const state = dbRef.current;
    const myId = state.meId ?? '';
    const participation = state.participants.find((p) => p.challengeId === challenge.id && p.userId === myId) ?? null;
    return {
      ...challenge,
      category: state.categories.find((c) => c.id === challenge.categoryId),
      joined: Boolean(participation),
      liked: state.likes.some((l) => l.challengeId === challenge.id && l.userId === myId),
      saved: state.saves.some((l) => l.challengeId === challenge.id && l.userId === myId),
      participation,
    };
  }, []);

  const findById = useCallback(
    (id: string) => {
      const ch = dbRef.current.challenges.find((c) => c.id === id);
      return ch ? getView(ch) : undefined;
    },
    [getView]
  );

  const recommended = useMemo(() => (db.meId ? rankChallenges(db, db.meId, 12) : []), [db]);
  const recommendedViews = useMemo(
    () =>
      recommended
        .map((r) => {
          const ch = db.challenges.find((c) => c.id === r.id);
          return ch ? { ...getView(ch), score: r.score, reason: r.reason } : null;
        })
        .filter((v): v is NonNullable<typeof v> => Boolean(v)),
    [recommended, db.challenges, getView]
  );
  const trending = useMemo(() => trendingCategories(db, 6), [db]);

  const myParticipations = useMemo(() => db.participants.filter((p) => p.userId === db.meId), [db.participants, db.meId]);
  const myActive = useMemo(() => myParticipations.filter((p) => p.status === 'active'), [myParticipations]);
  const myCompleted = useMemo(() => myParticipations.filter((p) => p.status === 'completed'), [myParticipations]);
  const savedViews = useMemo(() => db.saves.filter((s) => s.userId === db.meId).map((s) => db.challenges.find((c) => c.id === s.challengeId)).filter(Boolean).map((c) => getView(c!)), [db.saves, db.challenges, getView, db.meId]);
  const createdViews = useMemo(() => db.challenges.filter((c) => c.creatorId === db.meId).map((c) => getView(c)), [db.challenges, getView, db.meId]);
  const joinedViews = useMemo(() => myParticipations.map((p) => db.challenges.find((c) => c.id === p.challengeId)).filter(Boolean).map((c) => getView(c!)), [myParticipations, db.challenges, getView]);

  const searchAll = useCallback(
    (query: string): SearchResults => {
      const q = query.trim().toLowerCase();
      const state = dbRef.current;
      if (!q) return { challenges: [], categories: [], people: [] };
      const challenges = state.challenges
        .filter((c) => {
          const cat = state.categories.find((x) => x.id === c.categoryId);
          const creator = state.profiles[c.creatorId];
          return (
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.tags.some((t) => t.toLowerCase().includes(q)) ||
            (cat?.name.toLowerCase().includes(q) ?? false) ||
            (creator?.name.toLowerCase().includes(q) ?? false) ||
            (creator?.username.toLowerCase().includes(q) ?? false)
          );
        })
        .map((c) => getView(c));
      const categories = state.categories.filter((c) => c.name.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q));
      const people = Object.values(state.profiles)
        .filter((p) => p.id !== state.meId && (p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)))
        .map((p) => ({ id: p.id, name: p.name, username: p.username }));
      return { challenges, categories, people };
    },
    [getView]
  );

  const unreadNotifications = useMemo(() => db.notifications.filter((n) => !n.read).length, [db.notifications]);
  const unreadMessages = useMemo(() => db.threads.reduce((sum, t) => sum + t.unread, 0), [db.threads]);

  /* -------------------------------- actions ----------------------------- */

  const guard = useCallback(
    async (fn: () => Promise<void>, errorMsg: string): Promise<boolean> => {
      try {
        await fn();
        return true;
      } catch (err: any) {
        toast(err?.message ?? errorMsg, 'error');
        return false;
      }
    },
    [toast]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (adapter.kind === 'local') {
        await adapter.demoLogin!(email, password);
        setAuthed(true);
        return;
      }
      console.log('[SIGNIN] Attempting signInWithPassword...');
      const { createClient } = await import('@/lib/supabase/client');
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[SIGNIN] Error:', error);
        throw new Error(error.message);
      }
      console.log('[SIGNIN] Success! Redirecting to /feed with hard reload...');
      window.location.href = '/feed';
    },
    [adapter]
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<{ needsEmailConfirm: boolean }> => {
      if (adapter.kind === 'local') {
        await adapter.demoSignUp!(input);
        setAuthed(true);
        return { needsEmailConfirm: false };
      }
      const { createClient } = await import('@/lib/supabase/client');
      const { data, error } = await createClient().auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: { username: input.username, display_name: input.name } },
      });
      if (error) throw new Error(error.message);
      return { needsEmailConfirm: !data.session };
    },
    [adapter]
  );

  const signOut = useCallback(async () => {
    if (adapter.kind === 'local') {
      await adapter.demoLogout!();
      setAuthed(false);
      return;
    }
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    window.location.href = '/login';
  }, [adapter]);

  const demoResetPassword = useCallback(
    async (email: string, newPassword: string) => {
      if (adapter.kind !== 'local' || !adapter.demoResetPassword) {
        throw new Error('Password reset requires the configured auth provider.');
      }
      await adapter.demoResetPassword(email, newPassword);
    },
    [adapter]
  );

  const createChallenge = useCallback(
    async (input: CreateChallengeInput) => {
      try {
        const ch = await adapter.createChallenge(input);
        toast(`Challenge "${ch.title}" is live.`);
        return ch;
      } catch (err: any) {
        toast(err?.message ?? 'Could not create the challenge.', 'error');
        return null;
      }
    },
    [adapter, toast]
  );

  const value: StoreShape = {
    hydrated,
    dataMode,
    authed,
    authError,
    db,
    settings: db.settings,
    me,
    categories: db.categories,
    toasts,
    toast,
    dismissToast,
    getUser,
    getView,
    findById,
    recommended,
    recommendedViews,
    trending,
    myParticipations,
    myActive,
    myCompleted,
    savedViews,
    createdViews,
    joinedViews,
    searchAll,
    unreadNotifications,
    unreadMessages,
    notifications: db.notifications,
    threads: db.threads,
    signIn,
    signUp,
    signOut,
    demoResetPassword,
    createChallenge,
    updateChallenge: (id, patch) => guard(() => adapter.updateChallenge(id, patch).then(() => { toast('Challenge updated.'); }), 'Could not update the challenge.'),
    deleteChallenge: (id) => guard(() => adapter.deleteChallenge(id).then(() => { toast('Challenge deleted.', 'info'); }), 'Could not delete the challenge.'),
    joinChallenge: (id) =>
      guard(() => adapter.joinChallenge(id).then(() => {
        const ch = dbRef.current.challenges.find((c) => c.id === id);
        toast(ch ? `Joined ${ch.title}. Day 1 starts now.` : 'Joined challenge.');
      }), 'Could not join the challenge.'),
    leaveChallenge: (id) => guard(() => adapter.leaveChallenge(id).then(() => toast('Left the challenge.', 'info')), 'Could not leave the challenge.'),
    checkin: async (challengeId, note) => {
      try {
        const ck = await adapter.checkin(challengeId, note);
        const part = dbRef.current.participants.find((p) => p.challengeId === challengeId && p.userId === dbRef.current.meId);
        toast(part?.status === 'completed' ? 'Challenge completed. Legend.' : `Day ${ck.dayNumber} logged. Streak alive!`);
        return ck;
      } catch (err: any) {
        toast(err?.message ?? 'Check-in failed.', 'error');
        return null;
      }
    },
    toggleLike: (id) => guard(async () => { await adapter.toggleLike(id); }, 'Could not update like.'),
    toggleSave: (id) =>
      guard(async () => {
        const saved = await adapter.toggleSave(id);
        toast(saved ? 'Saved to your list.' : 'Removed from saved.', saved ? 'success' : 'info');
      }, 'Could not update save.'),
    shareChallenge: (id) =>
      guard(async () => {
        await adapter.shareChallenge(id);
        const url = `${window.location.origin}/feed#/challenge/${id}`;
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copied to clipboard.');
        } catch {
          toast('Share link ready.', 'info');
        }
      }, 'Could not share.'),
    addComment: (id, text) => guard(() => adapter.addComment(id, text).then(() => {}), 'Could not post the comment.'),
    deleteComment: (id) => guard(() => adapter.deleteComment(id).then(() => toast('Comment deleted.', 'info')), 'Could not delete the comment.'),
    viewChallenge: (id) => { void adapter.viewChallenge(id); },
    notInterested: (id) => {
      void adapter.notInterested(id);
      toast('Noted — we will show fewer like this.', 'info');
    },
    recordSearch: (q) => { void adapter.recordSearch(q); },
    openThreadWith: async (userId) => {
      try {
        return await adapter.openThreadWith(userId);
      } catch (err: any) {
        toast(err?.message ?? 'Could not open the conversation.', 'error');
        return null;
      }
    },
    sendMessage: (threadId, text) => guard(() => adapter.sendMessage(threadId, text), 'Message failed to send.'),
    markThreadRead: (threadId) => adapter.markThreadRead(threadId),
    markNotificationRead: (id) => adapter.markNotificationRead(id),
    markAllNotificationsRead: () => adapter.markAllNotificationsRead(),
    updateProfile: (patch) => guard(() => adapter.updateProfile(patch).then(() => toast('Profile updated.')), 'Could not update profile.'),
    updateSettings: (patch) => { void adapter.updateSettings(patch); },
    blockUser: (id) => { void adapter.blockUser(id); toast('User blocked.', 'info'); },
    unblockUser: (id) => { void adapter.unblockUser(id); toast('User unblocked.', 'info'); },
    resetLocal: async () => {
      await adapter.resetDemo();
      toast('Local data reset.', 'info');
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export type { ChallengeComment };
