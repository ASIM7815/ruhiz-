'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { StoreProvider, useStore } from '@/lib/store';
import type { ViewId, ViewRoute } from '@/lib/types';
import { NavContext } from './nav';
import TopBar from './TopBar';
import SideNav from './SideNav';
import BottomNav from './BottomNav';
import RightPanel from './RightPanel';
import Toasts from './Toasts';
import CreatePostModal from '@/components/post/CreatePostModal';
import HomeView from '@/components/views/HomeView';
import ExploreView from '@/components/views/ExploreView';
import JourneyView from '@/components/views/JourneyView';
import ConnectionsView from '@/components/views/ConnectionsView';
import MessagesView from '@/components/views/MessagesView';
import NotificationsView from '@/components/views/NotificationsView';
import SavedView from '@/components/views/SavedView';
import ProfileView from '@/components/views/ProfileView';
import SettingsView from '@/components/views/SettingsView';

const VALID_VIEWS: ViewId[] = ['home', 'explore', 'journey', 'connections', 'messages', 'notifications', 'saved', 'profile', 'settings'];

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
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<'photo' | 'video' | 'moment' | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  /* boot: parse hash, show brief branded splash */
  useEffect(() => {
    setRoute(parseHash());
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    const t = window.setTimeout(() => setSplash(false), store.hydrated ? 500 : 900);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const openCreate = useCallback((tab?: 'photo' | 'video' | 'moment') => {
    setCreateTab(tab ?? null);
    setCreateOpen(true);
  }, []);

  /* scroll to highlighted post when arriving via notification */
  useEffect(() => {
    if (route.view === 'home' && route.param?.startsWith('post-')) {
      const id = route.param;
      const t = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 700);
      return () => window.clearTimeout(t);
    }
  }, [route]);

  if (splash) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-4">
        <Image src="/images/ruhizlogo-.png" alt="Ruhiz" width={160} height={48} className="h-10 w-auto" priority />
        <div className="flex gap-1.5">
          <span className="typing-dot w-2.5 h-2.5 rounded-full bg-[var(--brand)] inline-block" />
          <span className="typing-dot w-2.5 h-2.5 rounded-full bg-[var(--brand)] inline-block" />
          <span className="typing-dot w-2.5 h-2.5 rounded-full bg-[var(--brand)] inline-block" />
        </div>
        <p className="text-sm text-[var(--muted)] italic">Different people. Different stories.</p>
      </div>
    );
  }

  const showRightPanel = route.view === 'home';

  return (
    <NavContext.Provider value={navApi}>
      <div className="min-h-screen bg-[var(--bg)]">
        <TopBar />
        <SideNav onCreate={() => openCreate()} />

        <main
          ref={mainRef}
          className={`pt-[64px] min-h-screen transition-all duration-300 md:ml-[76px] lg:ml-[250px] ${
            showRightPanel ? 'xl:mr-[330px]' : ''
          }`}
        >
          {store.dataMode === 'supabase-pending-migration' && route.view === 'home' && (
            <div className="max-w-[640px] mx-auto mb-4 px-4 py-3 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 text-sm flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <p className="leading-relaxed">
                You're signed in, but the production database isn't set up yet. Run{' '}
                <code className="px-1.5 py-0.5 rounded bg-amber-100 font-mono text-xs">supabase/migrations/20260913000000_ruhiz_production.sql</code>{' '}
                in the Supabase SQL Editor to unlock your live feed, chat and uploads. Everything works with demo content meanwhile.
              </p>
            </div>
          )}
          <div className="px-3 sm:px-6 py-5 pb-24 md:pb-8" key={`${route.view}-${route.param ?? ''}`}>
            {route.view === 'home' && <HomeView onCreate={openCreate} focusPostId={route.param?.startsWith('post-') ? route.param.slice(5) : undefined} />}
            {route.view === 'explore' && <ExploreView initialQuery={route.param ?? ''} />}
            {route.view === 'journey' && <JourneyView onCreate={() => openCreate()} />}
            {route.view === 'connections' && <ConnectionsView />}
            {route.view === 'messages' && <MessagesView initialThread={route.param} />}
            {route.view === 'notifications' && <NotificationsView />}
            {route.view === 'saved' && <SavedView />}
            {route.view === 'profile' && <ProfileView userId={route.param} onCreate={() => openCreate()} />}
            {route.view === 'settings' && <SettingsView />}
          </div>
        </main>

        {showRightPanel && <RightPanel />}
        <BottomNav onCreate={() => openCreate()} />

        <CreatePostModal open={createOpen} initialTab={createTab} onClose={() => setCreateOpen(false)} />
        <Toasts />

        {/* Floating quick-create on tablet/desktop for muscle memory */}
        <button
          onClick={() => openCreate()}
          className="hidden md:flex lg:hidden fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-[var(--brand)] text-white items-center justify-center shadow-xl hover:bg-[var(--brand-dark)] transition-colors"
          aria-label="Create post"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </NavContext.Provider>
  );
}
