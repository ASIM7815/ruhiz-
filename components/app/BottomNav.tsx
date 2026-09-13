'use client';

import { useStore } from '@/lib/store';
import { useNav } from './nav';
import { Icon } from '@/components/ui/Icons';
import type { ViewId } from '@/lib/types';

export default function BottomNav({ onCreate }: { onCreate: () => void }) {
  const { route, navigate } = useNav();
  const { unreadMessages } = useStore();

  const items: { id: ViewId; icon: string; label: string; badge?: number }[] = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'explore', icon: 'explore', label: 'Explore' },
    { id: 'messages', icon: 'chat', label: 'Chats', badge: unreadMessages },
    { id: 'profile', icon: 'user', label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-[var(--card)] border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-[62px]">
        {items.slice(0, 2).map((item) => (
          <NavBtn key={item.id} item={item} active={route.view === item.id} onClick={() => navigate(item.id)} />
        ))}
        {/* Center create button */}
        <div className="flex items-center justify-center">
          <button
            onClick={onCreate}
            aria-label="Create post"
            className="w-12 h-12 -mt-5 rounded-2xl bg-[var(--brand)] text-white flex items-center justify-center shadow-lg shadow-[var(--brand)]/30 active:scale-95 transition-transform"
          >
            <Icon name="plus" size={24} />
          </button>
        </div>
        {items.slice(2).map((item) => (
          <NavBtn key={item.id} item={item} active={route.view === item.id} onClick={() => navigate(item.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavBtn({
  item,
  active,
  onClick,
}: {
  item: { id: string; icon: string; label: string; badge?: number };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-0.5 ${active ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}`}
    >
      <span className="relative">
        <Icon name={item.icon} size={24} strokeWidth={active ? 2.4 : 2} />
        {!!item.badge && item.badge > 0 && (
          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {item.badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium">{item.label}</span>
    </button>
  );
}
