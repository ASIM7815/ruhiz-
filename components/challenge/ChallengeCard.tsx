'use client';

import { useState } from 'react';
import type { ChallengeView } from '@/lib/duel/types';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Cover, DifficultyBadge, ProgressBar } from '@/components/ui/Primitives';
import { compactCount } from '@/lib/format';

export default function ChallengeCard({ view, onOpen }: { view: ChallengeView; onOpen?: (id: string) => void }) {
  const { toggleLike, toggleSave, shareChallenge, getUser } = useStore();
  const { navigate } = useNav();
  const [likePop, setLikePop] = useState(false);

  const open = () => (onOpen ? onOpen(view.id) : navigate('challenge', view.id));
  const creator = getUser(view.creatorId);
  const part = view.participation;

  return (
    <article className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--brand)]/40 transition-colors group flex flex-col">
      <button onClick={open} className="relative h-36 w-full text-left flex-shrink-0" aria-label={`Open ${view.title}`}>
        <Cover coverUrl={view.coverUrl} category={view.category} title={view.title} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-white text-[11px] font-semibold flex items-center gap-1.5">
          <span>{view.category?.emoji}</span> {view.category?.name}
        </span>
        <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-[var(--brand)] text-black text-[11px] font-bold display">
          {view.durationDays} Days
        </span>
        {part?.status === 'completed' && (
          <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/80 text-[var(--brand)] text-[11px] font-bold flex items-center gap-1">
            <Icon name="trophy" size={12} /> Completed
          </span>
        )}
      </button>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <button onClick={open} className="text-left w-full">
            <h3 className="font-bold text-[var(--text)] text-[15px] leading-snug group-hover:text-[var(--brand)] transition-colors">{view.title}</h3>
          </button>
          <p className="text-[13px] text-[var(--muted)] mt-1 line-clamp-2 leading-relaxed">{view.description}</p>
        </div>

        {view.reason && (
          <p className="text-[11px] font-semibold text-[var(--brand)] bg-[var(--brand-soft)] rounded-full px-2.5 py-1 self-start flex items-center gap-1">
            <Icon name="spark" size={11} /> {view.reason}
          </p>
        )}

        {part && part.status === 'active' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1 font-semibold text-[var(--brand)]">
                <Icon name="flame" size={12} className={part.currentStreak > 0 ? 'flame-live' : ''} /> {part.currentStreak}-day streak
              </span>
              <span>
                Day {part.completedDays}/{view.durationDays}
              </span>
            </div>
            <ProgressBar value={part.completedDays} max={view.durationDays} />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-[12px] text-[var(--muted)]">
            <span className="flex items-center gap-1" title="Participants">
              <Icon name="people" size={14} /> {compactCount(view.participantCount)}
            </span>
            <span className="flex items-center gap-1" title="Likes">
              <Icon name="heart" size={14} /> {compactCount(view.likeCount)}
            </span>
            <DifficultyBadge level={view.difficulty} />
          </div>

          <div className="flex items-center gap-1">
            <IconBtn
              label={view.liked ? 'Unlike' : 'Like'}
              active={view.liked}
              onClick={async () => {
                setLikePop(true);
                window.setTimeout(() => setLikePop(false), 400);
                await toggleLike(view.id);
              }}
              icon="heart"
              pop={likePop}
            />
            <IconBtn label={view.saved ? 'Unsave' : 'Save'} active={view.saved} onClick={() => toggleSave(view.id)} icon="bookmark" />
            <IconBtn label="Share" onClick={() => shareChallenge(view.id)} icon="share" />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <span className="text-[11px] text-[var(--muted)] truncate">
            by <button onClick={() => navigate('profile', view.creatorId)} className="font-semibold text-[var(--text)] hover:text-[var(--brand)]">@{creator.username}</button>
          </span>
          <button
            onClick={open}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[var(--card-2)] hover:bg-[var(--brand)] hover:text-black text-[var(--text)] text-[12px] font-bold transition-colors flex items-center gap-1"
          >
            {part ? 'Continue' : 'View'} <Icon name="arrowRight" size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  active = false,
  pop = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  pop?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-2 rounded-lg transition-colors ${active ? 'text-[var(--brand)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card-2)]'} ${pop ? 'like-pop' : ''}`}
    >
      <Icon name={icon} size={17} filled={active && icon === 'heart'} />
    </button>
  );
}
