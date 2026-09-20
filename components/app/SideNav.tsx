'use client';

import { useStore } from '@/lib/duel/store';
import { useNav } from './nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Primitives';
import type { ViewId } from '@/lib/types';

export const NAV_ITEMS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'explore', label: 'Explore', icon: 'explore' },
  { id: 'create', label: 'Create Challenge', icon: 'plus' },
  { id: 'challenges', label: 'My Challenges', icon: 'swords' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'messages', label: 'Messages', icon: 'chat' },
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function SideNav() {
  const { route, navigate } = useNav();
  const { me, unreadMessages, unreadNotifications, myActive } = useStore();

  const badge = (id: ViewId) =>
    id === 'messages' ? unreadMessages : id === 'notifications' ? unreadNotifications : id === 'challenges' ? myActive.length : 0;

  if (!me) return null;

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-[64px] bottom-0 w-[76px] lg:w-[248px] bg-[var(--card)] border-r border-[var(--border)] z-40">
      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 lg:p-4">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = route.view === item.id;
            const count = badge(item.id);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-center lg:justify-between gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  active ? 'bg-[var(--brand)] text-black shadow-sm' : 'text-[var(--text)] hover:bg-[var(--card-2)]'
                }`}
              >
                <span className="relative flex items-center gap-3">
                  <Icon name={item.icon} size={21} />
                  <span className="hidden lg:inline font-semibold text-[14px]">{item.label}</span>
                  {count > 0 && (
                    <span className="lg:hidden absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--brand)] text-black text-[10px] font-bold flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </span>
                {count > 0 && (
                  <span className={`hidden lg:inline px-2 py-0.5 text-xs rounded-full font-bold ${active ? 'bg-black/15 text-black' : 'bg-[var(--brand-soft)] text-[var(--brand)]'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => navigate('create')}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--brand)] text-black font-bold rounded-xl hover:bg-[var(--brand-dark)] transition-colors shadow-sm display text-sm"
        >
          <Icon name="plus" size={18} strokeWidth={3} />
          <span className="hidden lg:inline">New Challenge</span>
        </button>

        {/* Motivation card */}
        <div className="hidden lg:block mt-6 bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4 relative overflow-hidden">
          <p className="display text-[15px] text-[var(--text)] leading-snug">
            Challenge<br />a better you.
          </p>
          <p className="text-xs text-[var(--muted)] mt-2">Show up daily. Stack the streak. Win the duel.</p>
          <Icon name="bolt" size={54} className="absolute -bottom-2 -right-2 text-[var(--brand)] opacity-20" />
        </div>
      </div>

      {/* Bottom user chip */}
      <div className="p-3 lg:p-4 border-t border-[var(--border)]">
        <button onClick={() => navigate('profile')} className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--card-2)] transition-colors">
          <Avatar user={me!} size={38} />
          <span className="hidden lg:block text-left min-w-0">
            <span className="block text-sm font-semibold text-[var(--text)] truncate">{me?.name}</span>
            <span className="block text-xs text-[var(--muted)] truncate">@{me?.username}</span>
          </span>
        </button>
        <p className="hidden lg:block text-[11px] text-[var(--muted)] mt-3 px-2">© 2026 DUEL · Challenge a better you</p>
      </div>
    </aside>
  );
}
