'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StoreProvider, useStore } from '@/lib/duel/store';
import type { ViewId, ViewRoute } from '@/lib/types';
import { NavContext } from './nav';
import { Icon } from '@/components/ui/Icons';
import TopBar from './TopBar';
import SideNav from './SideNav';
import BottomNav from './BottomNav';
import RightPanel from './RightPanel';
import Toasts from './Toasts';
import Logo from '@/components/ui/Logo';
import HomeView from '@/components/views/HomeView';
import ExploreView from '@/components/views/ExploreView';
import CreateChallengeView from '@/components/views/CreateChallengeView';
import MyChallengesView from '@/components/views/MyChallengesView';
import ProgressView from '@/components/views/ProgressView';
import NotificationsView from '@/components/views/NotificationsView';
import MessagesView from '@/components/views/MessagesView';
import ProfileView from '@/components/views/ProfileView';
import SettingsView from '@/components/views/SettingsView';
import ChallengeDetailView from '@/components/views/ChallengeDetailView';

const VALID_VIEWS: ViewId[] = [
  'home', 'explore', 'create', 'challenges', 'progress',
  'notifications', 'messages', 'profile', 'settings', 'challenge',
];

function parseHash(): ViewRoute {
  if (typeof window === 'undefined') return { view: 'home' };
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return { view: 'home' };
  const [view, ...rest] = raw.split('/');
  const param = rest.join('/') || undefined;
  if (!VALID_VIEWS.includes(view as ViewId)) return { view: 'home' };
  return { view: view as ViewId, param };
}

export default function AppShell() {
  return (
    <StoreProvider>
      <ShellInner />
    </StoreProvider>
  );
}

function ShellInner() {
  const store = useStore();
  const [route, setRoute] = useState<ViewRoute>({ view: 'home' });
  const [splash, setSplash] = useState(true);

  /* boot: parse hash route */
  useEffect(() => {
    setRoute(parseHash());
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);

  /* splash until hydrated */
  useEffect(() => {
    if (!store.hydrated) return;
    const t = window.setTimeout(() => setSplash(false), 450);
    return () => window.clearTimeout(t);
  }, [store.hydrated]);

  /* auth guard: the app area requires a session */
  useEffect(() => {
    if (store.hydrated && !store.authed && !splash) {
      window.location.replace('/login');
    }
  }, [store.hydrated, store.authed, splash]);

  const navigate = useCallback((view: ViewId, param?: string) => {
    const next: ViewRoute = { view, param };
    setRoute(next);
    const hash = param ? `#/${view}/${param}` : `#/${view}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash);
    }
    window.scrollTo({ top: 0 });
  }, []);

  const navApi = useMemo(() => ({ route, navigate }), [route, navigate]);

  if (splash || !store.hydrated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-5">
        <Logo height={54} priority withTagline />
        <div className="flex gap-1.5">
          <span className="typing-dot w-2.5 h-2.5 rounded-full bg-[#16e08a] inline-block" />
          <span className="typing-dot w-2.5 h-2.5 rounded-full bg-[#16e08a] inline-block" />
          <span className="typing-dot w-2.5 h-2.5 rounded-full bg-[#16e08a] inline-block" />
        </div>
        <p className="text-sm text-white/50 tracking-[0.25em] uppercase text-[11px]">Challenge a better you</p>
      </div>
    );
  }

  if (!store.authed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/60 text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  if (store.authError) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl text-center bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8">
          <Logo height={36} className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[var(--text)] mb-3">Live data unavailable</h1>
          <p className="text-sm text-[var(--muted)] mb-6">{store.authError}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl bg-[var(--brand)] text-black text-sm font-bold hover:bg-[var(--brand-dark)]">
              Retry
            </button>
            <button onClick={() => void store.signOut()} className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--card-2)]">
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showRightPanel = route.view === 'home';

  return (
    <NavContext.Provider value={navApi}>
      <div className="min-h-screen bg-[var(--bg)]">
        <TopBar />
        <SideNav />
        {store.dataMode === 'demo' && (
          <div className="fixed top-[64px] inset-x-0 z-30 md:ml-[76px] lg:ml-[248px] px-3 sm:px-6">
            <div className="mx-auto max-w-3xl mt-2 px-4 py-2 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/30 text-[11px] sm:text-xs text-[var(--brand)] flex items-center gap-2">
              <Icon name="info" size={14} className="flex-shrink-0" />
              <span>
                Preview mode — data lives in this browser only. Connect Supabase (<code className="font-mono">.env.local</code>) to go live.
              </span>
            </div>
          </div>
        )}

        <main
          className={`pt-[64px] min-h-screen transition-all duration-300 md:ml-[76px] lg:ml-[248px] ${
            showRightPanel ? 'xl:mr-[330px]' : ''
          }`}
        >
          <div className="px-3 sm:px-6 py-5 pb-24 md:pb-8" key={`${route.view}-${route.param ?? ''}`}>
            {route.view === 'home' && <HomeView />}
            {route.view === 'explore' && <ExploreView initialQuery={route.param ?? ''} />}
            {route.view === 'create' && <CreateChallengeView editId={route.param} />}
            {route.view === 'challenges' && <MyChallengesView />}
            {route.view === 'progress' && <ProgressView />}
            {route.view === 'notifications' && <NotificationsView />}
            {route.view === 'messages' && <MessagesView initialThread={route.param} />}
            {route.view === 'profile' && <ProfileView userId={route.param} />}
            {route.view === 'settings' && <SettingsView />}
            {route.view === 'challenge' && <ChallengeDetailView challengeId={route.param ?? ''} />}
          </div>
        </main>

        {showRightPanel && <RightPanel />}
        <BottomNav />
        <Toasts />
      </div>
    </NavContext.Provider>
  );
}
