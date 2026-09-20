'use client';

import { useStore } from '@/lib/duel/store';
import { Icon } from '@/components/ui/Icons';

export default function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto pop-in flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] pl-4 pr-3 py-2.5 rounded-full shadow-xl text-sm font-medium max-w-full"
        >
          <span
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              t.type === 'error' ? 'bg-red-500' : t.type === 'info' ? 'bg-sky-500' : 'bg-[var(--brand)]'
            } text-black`}
          >
            <Icon name={t.type === 'error' ? 'close' : 'check'} size={12} strokeWidth={3} />
          </span>
          <span className="truncate">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
