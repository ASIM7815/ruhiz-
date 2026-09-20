'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Badge, EmptyState, FeedSkeleton, Modal, ModalHeader, PrimaryButton, Segmented } from '@/components/ui/Primitives';
import ChallengeCard from '@/components/challenge/ChallengeCard';
import { durationBucket, type Challenge, type Checkin, type DurationBucket } from '@/lib/duel/types';
import { R2Image, R2Video } from '@/components/ui/Media';
import { fullDate } from '@/lib/format';

type ExploreTab = 'videos' | 'photos' | 'challenges';
type SortKey = 'recommended' | 'popular' | 'newest';

interface EnrichedProofItem {
  checkin: Checkin;
  challenge: Challenge;
  author: any;
}

export default function ExploreView({ initialQuery = '' }: { initialQuery?: string }) {
  const store = useStore();
  const { navigate } = useNav();

  const [activeTab, setActiveTab] = useState<ExploreTab>('videos');
  const [query, setQuery] = useState(initialQuery);
  const [searched, setSearched] = useState(initialQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [bucket, setBucket] = useState<DurationBucket | 'any'>('any');
  const [sort, setSort] = useState<SortKey>('newest');
  const [lightboxProof, setLightboxProof] = useState<EnrichedProofItem | null>(null);

  const recordedRef = useRef<string>('');

  useEffect(() => {
    setQuery(initialQuery);
    setSearched(initialQuery);
    if (initialQuery.trim()) {
      setActiveTab('challenges');
    }
  }, [initialQuery]);

  // Record searches for recommendation learning
  useEffect(() => {
    if (!searched.trim()) return;
    if (recordedRef.current === searched) return;
    const t = window.setTimeout(() => {
      recordedRef.current = searched;
      store.recordSearch(searched);
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searched]);

  // Extract all real video proofs from the database
  const videoProofs = useMemo<EnrichedProofItem[]>(() => {
    const list: EnrichedProofItem[] = [];
    for (const ck of store.db.checkins) {
      if (ck.mediaType === 'video' && ck.mediaUrl) {
        const ch = store.db.challenges.find((c) => c.id === ck.challengeId);
        if (ch) {
          const author = store.getUser(ck.userId);
          list.push({ checkin: ck, challenge: ch, author });
        }
      }
    }
    return list.sort((a, b) => b.checkin.createdAt.localeCompare(a.checkin.createdAt));
  }, [store.db.checkins, store.db.challenges, store]);

  // Extract all real photo proofs from the database
  const photoProofs = useMemo<EnrichedProofItem[]>(() => {
    const list: EnrichedProofItem[] = [];
    for (const ck of store.db.checkins) {
      if (ck.mediaType === 'image' && ck.mediaUrl) {
        const ch = store.db.challenges.find((c) => c.id === ck.challengeId);
        if (ch) {
          const author = store.getUser(ck.userId);
          list.push({ checkin: ck, challenge: ch, author });
        }
      }
    }
    return list.sort((a, b) => b.checkin.createdAt.localeCompare(a.checkin.createdAt));
  }, [store.db.checkins, store.db.challenges, store]);

  // Real challenges list
  const filteredChallenges = useMemo(() => {
    let list = store.db.challenges.filter((c) => c.status === 'open');
    if (searched.trim()) {
      const r = store.searchAll(searched);
      list = r.challenges.map((v) => store.db.challenges.find((c) => c.id === v.id)!).filter(Boolean);
    }
    if (category) list = list.filter((c) => c.categoryId === category);
    if (bucket !== 'any') list = list.filter((c) => durationBucket(c.durationDays) === bucket);
    const views = list.map((c) => store.getView(c));
    if (sort === 'popular') views.sort((a, b) => b.participantCount - a.participantCount);
    else if (sort === 'newest') views.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else views.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.participantCount - a.participantCount);
    return views;
  }, [store.db.challenges, searched, category, bucket, sort, store]);

  if (!store.hydrated) return <FeedSkeleton count={6} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-[var(--text)] font-bold">Explore</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Discover real daily challenge proof videos, photos, and live duels.
          </p>
        </div>

        {/* Primary View Switcher: Videos | Photos | Challenges */}
        <div className="flex bg-[var(--card)] border border-[var(--border)] p-1 rounded-2xl shadow-sm self-start sm:self-auto">
          <TabButton
            active={activeTab === 'videos'}
            onClick={() => setActiveTab('videos')}
            icon="bolt"
            label="Videos"
            count={videoProofs.length}
          />
          <TabButton
            active={activeTab === 'photos'}
            onClick={() => setActiveTab('photos')}
            icon="image"
            label="Photos"
            count={photoProofs.length}
          />
          <TabButton
            active={activeTab === 'challenges'}
            onClick={() => setActiveTab('challenges')}
            icon="swords"
            label="Challenges"
            count={store.db.challenges.length}
          />
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: VIDEOS FEED (Vertically scrollable / playable video proof)     */}
      {/* =================================================================== */}
      {activeTab === 'videos' && (
        <div className="space-y-6">
          {videoProofs.length === 0 ? (
            <EmptyState
              icon="bolt"
              title="No proof videos uploaded yet"
              description="When real challengers complete their daily check-ins with video proof, they will appear in this vertical feed."
              action={
                <PrimaryButton onClick={() => navigate('challenges')}>
                  Go to My Challenges
                </PrimaryButton>
              }
            />
          ) : (
            <div className="space-y-6 max-w-xl mx-auto">
              <p className="text-xs text-[var(--muted)] px-1">
                Showing {videoProofs.length} verified proof video{videoProofs.length === 1 ? '' : 's'}
              </p>
              {videoProofs.map((item) => (
                <VideoFeedCard
                  key={item.checkin.id}
                  item={item}
                  onOpenChallenge={() => navigate('challenge', item.challenge.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PHOTOS FEED (Visual discovery feed of daily proof photos)    */}
      {/* =================================================================== */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          {photoProofs.length === 0 ? (
            <EmptyState
              icon="image"
              title="No proof photos uploaded yet"
              description="When challengers upload daily photo proofs for their duels, they will be showcased here."
              action={
                <PrimaryButton onClick={() => navigate('challenges')}>
                  Go to My Challenges
                </PrimaryButton>
              }
            />
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-[var(--muted)]">
                Showing {photoProofs.length} verified proof photo{photoProofs.length === 1 ? '' : 's'}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photoProofs.map((item) => (
                  <PhotoFeedCard
                    key={item.checkin.id}
                    item={item}
                    onClick={() => setLightboxProof(item)}
                    onOpenChallenge={() => navigate('challenge', item.challenge.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: CHALLENGES DIRECTORY (Real challenges created by users)      */}
      {/* =================================================================== */}
      {activeTab === 'challenges' && (
        <div className="space-y-6">
          {/* Search Input */}
          <div className="relative">
            <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(e.target.value);
              }}
              placeholder="Search challenges, categories or creators…"
              aria-label="Search challenges"
              className="w-full pl-11 pr-10 py-3.5 bg-[var(--card)] border border-[var(--border)] rounded-2xl text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setSearched('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[var(--muted)] hover:bg-[var(--card-2)]"
                aria-label="Clear search"
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>

          {/* Filters & Sorting */}
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <Chip active={category === null} onClick={() => setCategory(null)}>
                All categories
              </Chip>
              {store.categories.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
                  <span className="mr-1">{c.emoji}</span>
                  {c.name}
                </Chip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                options={[
                  { value: 'any' as const, label: 'Any length' },
                  { value: 'sprint' as const, label: '≤7d' },
                  { value: 'short' as const, label: '8–14d' },
                  { value: 'classic' as const, label: '15–30d' },
                  { value: 'marathon' as const, label: '30d+' },
                ]}
                value={bucket}
                onChange={setBucket}
              />
              <div className="ml-auto">
                <Segmented
                  options={[
                    { value: 'newest' as SortKey, label: 'Newest' },
                    { value: 'popular' as SortKey, label: 'Popular' },
                    { value: 'recommended' as SortKey, label: 'For you' },
                  ]}
                  value={sort}
                  onChange={setSort}
                />
              </div>
            </div>
          </div>

          {/* Challenge Results */}
          {filteredChallenges.length === 0 ? (
            <EmptyState
              icon="search"
              title="No challenges found"
              description="No challenges match your search. Create the first challenge in this category!"
              action={
                <PrimaryButton onClick={() => navigate('create')}>
                  Create a challenge
                </PrimaryButton>
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[var(--muted)]">
                {filteredChallenges.length} challenge{filteredChallenges.length === 1 ? '' : 's'} found
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredChallenges.map((v) => (
                  <ChallengeCard key={v.id} view={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal for Photo Inspection */}
      {lightboxProof && (
        <Modal open={true} onClose={() => setLightboxProof(null)} maxWidth="max-w-2xl" labelledBy="photo-proof-title">
          <ModalHeader
            title={`Day ${lightboxProof.checkin.dayNumber} Proof`}
            onClose={() => setLightboxProof(null)}
            subtitle={lightboxProof.challenge.title}
          />
          <div className="p-5 space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black max-h-[60vh] flex items-center justify-center">
              <R2Image mediaKey={lightboxProof.checkin.mediaUrl} alt="Proof" className="w-full max-h-[60vh] object-contain" />
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-3">
                <Avatar user={lightboxProof.author} size={38} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{lightboxProof.author?.name}</p>
                  <p className="text-xs text-[var(--muted)]">@{lightboxProof.author?.username}</p>
                </div>
              </div>
              <PrimaryButton onClick={() => { setLightboxProof(null); navigate('challenge', lightboxProof.challenge.id); }} className="!py-1.5 !px-3 text-xs">
                View Challenge
              </PrimaryButton>
            </div>
            {lightboxProof.checkin.note && (
              <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap bg-[var(--card-2)] p-3.5 rounded-xl border border-[var(--border)]">
                {lightboxProof.checkin.note}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------- Subcomponents ------------------------------ */

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
        active
          ? 'bg-[var(--brand)] text-black shadow-sm'
          : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${active ? 'bg-black/20 text-black' : 'bg-[var(--card-2)] text-[var(--muted)]'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
        active
          ? 'bg-[var(--brand)] text-black border-[var(--brand)]'
          : 'bg-[var(--card)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------- Vertical Video Card -------------------------- */

function VideoFeedCard({
  item,
  onOpenChallenge,
}: {
  item: EnrichedProofItem;
  onOpenChallenge: () => void;
}) {
  const { checkin, challenge, author } = item;

  return (
    <article className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-lg transition-colors hover:border-[var(--brand)]/40 flex flex-col">
      {/* Header Info */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--border)]">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar user={author} size={42} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text)] truncate">{author?.name}</p>
            <p className="text-xs text-[var(--muted)] truncate">@{author?.username}</p>
          </div>
        </div>

        <button
          onClick={onOpenChallenge}
          className="px-3 py-1.5 rounded-xl bg-[var(--card-2)] hover:bg-[var(--brand)] hover:text-black text-[var(--text)] text-xs font-bold transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <span>View Challenge</span>
          <Icon name="arrowRight" size={13} />
        </button>
      </div>

      {/* Video Player */}
      <div className="bg-black relative aspect-[4/5] sm:aspect-[16/11] max-h-[560px] flex items-center justify-center overflow-hidden">
        <R2Video
          mediaKey={checkin.mediaUrl}
          controls
          className="w-full h-full object-contain"
        />
      </div>

      {/* Footer Info */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-xs font-bold">
            Day {checkin.dayNumber} of {challenge.durationDays}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {fullDate(checkin.date || checkin.createdAt)}
          </span>
        </div>

        <div>
          <button
            onClick={onOpenChallenge}
            className="text-left font-bold text-sm text-[var(--text)] hover:text-[var(--brand)] transition-colors line-clamp-1"
          >
            {challenge.title}
          </button>
          {checkin.note && (
            <p className="text-xs sm:text-sm text-[var(--muted)] mt-1.5 whitespace-pre-wrap leading-relaxed line-clamp-4">
              {checkin.note}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------- Photo Discovery Card -------------------------- */

function PhotoFeedCard({
  item,
  onClick,
  onOpenChallenge,
}: {
  item: EnrichedProofItem;
  onClick: () => void;
  onOpenChallenge: () => void;
}) {
  const { checkin, challenge, author } = item;

  return (
    <article className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--brand)]/40 transition-colors flex flex-col group">
      {/* Photo with hover click */}
      <div
        onClick={onClick}
        className="relative aspect-square w-full bg-black cursor-pointer overflow-hidden"
      >
        <R2Image
          mediaKey={checkin.mediaUrl}
          alt={`Proof for ${challenge.title}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur text-white text-[11px] font-bold">
          Day {checkin.dayNumber}
        </span>
      </div>

      <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between">
        <div>
          <button
            onClick={onOpenChallenge}
            className="font-bold text-xs text-[var(--text)] hover:text-[var(--brand)] transition-colors line-clamp-1 text-left"
          >
            {challenge.title}
          </button>
          {checkin.note && (
            <p className="text-[12px] text-[var(--muted)] mt-1 line-clamp-2 leading-relaxed">
              {checkin.note}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar user={author} size={22} />
            <span className="text-[var(--muted)] truncate">@{author?.username}</span>
          </div>
          <span className="text-[var(--muted)]">{fullDate(checkin.date || checkin.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}
