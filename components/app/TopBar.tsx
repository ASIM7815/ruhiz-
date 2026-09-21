'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from './nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Primitives';
import Logo from '@/components/ui/Logo';

export default function TopBar() {
  const { me, unreadMessages, unreadNotifications, settings, updateSettings, signOut, toast, recordSearch, db } = useStore();
  const { navigate } = useNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submitSearch = () => {
    const q = query.trim();
    recordSearch(q);
    navigate('explore', q || undefined);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    toast('Signed out. See you at the next duel.', 'info');
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] z-[70] bg-[var(--header)] border-b border-white/10">
      <div className="h-full px-4 md:px-6 flex items-center gap-3">
        <Logo height={30} onClick={() => navigate('home')} priority />

        {/* Search (desktop) */}
        <div className="hidden md:block flex-1 max-w-xl mx-auto">
          <div className="relative">
            <Icon name="search" size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder="Search posts, people, challenges, or categories…"
              aria-label="Search posts, people, challenges, or categories"
              className="w-full pl-11 pr-4 py-2.5 bg-white/10 border border-white/15 rounded-full text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 focus:bg-white/15 transition-all"
            />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 md:gap-2 ml-auto">
          <button
            onClick={() => navigate('notifications')}
            className="relative p-2.5 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label={`Notifications (${unreadNotifications} unread)`}
          >
            <Icon name="bell" size={22} />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand)] text-black text-[10px] font-bold flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('messages')}
            className="relative p-2.5 rounded-full hover:bg-white/10 text-white transition-colors"
            aria-label={`Messages (${unreadMessages} unread)`}
          >
            <Icon name="chat" size={22} />
            {unreadMessages > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand)] text-black text-[10px] font-bold flex items-center justify-center">
                {unreadMessages}
              </span>
            )}
          </button>

          {/* Mobile search */}
          <button onClick={() => navigate('explore')} className="md:hidden p-2.5 rounded-full hover:bg-white/10 text-white transition-colors" aria-label="Search">
            <Icon name="search" size={22} />
          </button>

          {/* Avatar menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="ml-1 rounded-full ring-2 ring-transparent hover:ring-[var(--brand)]/60 transition-all"
              aria-label="Account menu"
            >
              {me && <Avatar user={me} size={38} />}
            </button>
            {menuOpen && me && (
              <div className="pop-in absolute right-0 top-full mt-2 w-72 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden z-[80]">
                <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center gap-3">
                  <Avatar user={me} size={44} />
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text)] truncate">{me.name}</p>
                    <p className="text-xs text-[var(--muted)] truncate">@{me.username}</p>
                  </div>
                </div>
                <div className="py-1.5">
                  <MenuItem icon="user" label="My Profile" onClick={() => { setMenuOpen(false); navigate('profile'); }} />
                  <MenuItem icon="swords" label="My Challenges" onClick={() => { setMenuOpen(false); navigate('challenges'); }} />
                  <MenuItem icon="chart" label="Progress" onClick={() => { setMenuOpen(false); navigate('progress'); }} />
                  <MenuItem icon="settings" label="Settings" onClick={() => { setMenuOpen(false); navigate('settings'); }} />
                  <MenuItem
                    icon={settings.theme === 'dark' ? 'sun' : 'moon'}
                    label={settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                  />
                </div>
                <div className="border-t border-[var(--border)] py-1.5">
                  <MenuItem icon="logout" label="Log out" danger onClick={handleLogout} />
                </div>
                <div className="px-4 py-2 border-t border-[var(--border)] text-[11px] text-[var(--muted)]">
                  {db.challenges.length} live challenges · {db.participants.length} active duels
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, label, onClick, danger = false }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
        danger ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)]' : 'text-[var(--text)] hover:bg-[var(--card-2)]'
      }`}
    >
      <Icon name={icon} size={18} className={danger ? 'text-[var(--danger)]' : 'text-[var(--muted)]'} />
      {label}
    </button>
  );
}
