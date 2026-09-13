'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/Primitives';
import PostCard from '@/components/post/PostCard';

export default function SavedView() {
  const store = useStore();
  const { navigate } = useNav();
  const [mode, setMode] = useState<'list' | 'grid'>('list');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const saved = useMemo(() => store.posts.filter((p) => p.savedByMe), [store.posts]);

  return (
    <div className="max-w-[640px] mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-1">Saved</h1>
          <p className="text-sm text-[var(--muted)]">
            {saved.length === 0 ? 'Moments you save will live here.' : `${saved.length} moment${saved.length === 1 ? '' : 's'} in your collection`}
          </p>
        </div>
        {saved.length > 0 && (
          <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode('list')}
              className={`p-2 rounded-lg transition-colors ${mode === 'list' ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'text-[var(--muted)]'}`}
              aria-label="List view"
            >
              <Icon name="list" size={16} />
            </button>
            <button
              onClick={() => setMode('grid')}
              className={`p-2 rounded-lg transition-colors ${mode === 'grid' ? 'bg-[var(--brand-soft)] text-[var(--brand)]' : 'text-[var(--muted)]'}`}
              aria-label="Grid view"
            >
              <Icon name="grid" size={16} />
            </button>
          </div>
        )}
      </div>

      {saved.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Nothing saved yet"
          description="Tap the bookmark on any moment to keep it here for later. Your private little library of comfort."
          action={
            <button onClick={() => navigate('home')} className="px-5 py-2.5 bg-[var(--brand)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--brand-dark)]">
              Browse your feed
            </button>
          }
        />
      ) : mode === 'list' ? (
        <div className="space-y-5">
          {saved.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {saved.map((p) => (
            <button
              key={p.id}
              onClick={() => (p.image ? setLightbox(p.image!) : setMode('list'))}
              className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border)] group"
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : p.video ? (
                <span className="w-full h-full bg-[var(--card-2)] flex flex-col items-center justify-center gap-1 text-[var(--muted)]">
                  <Icon name="video" size={22} />
                  <span className="text-[10px] font-medium">Video</span>
                </span>
              ) : (
                <span className="w-full h-full bg-[var(--brand-soft)] p-2.5 flex items-start">
                  <span className="text-[10px] leading-snug text-[var(--text)] line-clamp-6 text-left">“{p.text}”</span>
                </span>
              )}
              {p.savedByMe && (
                <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
                  <Icon name="bookmark" size={14} filled />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white" aria-label="Close image">
            <Icon name="close" size={26} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-lg object-contain pop-in" />
        </div>
      )}
    </div>
  );
}
