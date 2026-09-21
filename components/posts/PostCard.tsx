'use client';

import { useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Primitives';
import { R2Image, R2Video } from '@/components/ui/Media';
import { compactCount, timeAgo } from '@/lib/format';
import type { ChallengePost } from '@/lib/duel/types';

/**
 * A progress post rendered as a discovery card (Explore grid / challenge
 * activity feed). Shows real author, real challenge link, real engagement
 * counters — and nothing else.
 */
export default function PostCard({
  post,
  onOpen,
  onEdit,
  compact = false,
}: {
  post: ChallengePost;
  onOpen: () => void;
  onEdit?: () => void;
  compact?: boolean;
}) {
  const store = useStore();
  const { navigate } = useNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const author = store.getUser(post.userId);
  const challenge = store.db.challenges.find((c) => c.id === post.challengeId);
  const isMine = post.userId === store.db.meId;
  const liked = store.hasLikedPost(post.id);
  const saved = store.hasSavedPost(post.id);
  const cat = challenge ? store.categories.find((c) => c.id === challenge.categoryId) : undefined;

  const goChallenge = (id: string) => {
    setMenuOpen(false);
    navigate('challenge', id);
  };

  return (
    <article className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--brand)]/40 transition-colors flex flex-col group">
      {/* author row */}
      <div className="p-3 flex items-center gap-2.5">
        <Avatar user={author} size={32} onClick={() => navigate('profile', author.id)} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text)] truncate flex items-center gap-1.5">
            {author.name}
            {author.verified && <Icon name="badge" size={12} className="text-[var(--brand)]" />}
          </p>
          <p className="text-[11px] text-[var(--muted)]">@{author.username} · {timeAgo(post.createdAt)}</p>
        </div>
        {onEdit && (
          <button onClick={onEdit} title="Edit this post" className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--text)]">
            <Icon name="edit" size={14} />
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--card-2)]"
            aria-label="Post menu"
          >
            <Icon name="dots" size={15} />
          </button>
          {menuOpen && (
            <div className="pop-in absolute right-0 top-full mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden">
              <button
                onClick={() => { setMenuOpen(false); navigate('profile', author.id); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
              >
                <Icon name="user" size={14} className="text-[var(--muted)]" /> View profile
              </button>
              {challenge && (
                <button
                  onClick={() => goChallenge(challenge.id)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                >
                  <Icon name="swords" size={14} className="text-[var(--muted)]" /> View challenge
                </button>
              )}
              {isMine && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (window.confirm('Delete this post? Your progress for this day will be recomputed.')) {
                      void store.deletePost(post.id);
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)] flex items-center gap-2"
                >
                  <Icon name="trash" size={14} /> Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* media */}
      {post.mediaUrl ? (
        <div className="relative bg-black cursor-pointer" onClick={onOpen}>
          {post.mediaType === 'video' ? (
            <div className={`relative ${compact ? 'aspect-square' : 'aspect-[4/5] sm:aspect-[4/3]'}`}>
              <R2Video mediaKey={post.mediaUrl} controls={false} className="w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Icon name="play" size={20} />
                </span>
              </span>
            </div>
          ) : (
            <div className={compact ? 'aspect-square' : 'aspect-[4/5] sm:aspect-[4/3]'}>
              <R2Image mediaKey={post.mediaUrl} alt={`Day ${post.dayNumber} proof`} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
            </div>
          )}
          {/* Day overlay — the post's day inside its challenge */}
          <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur text-white text-[11px] font-bold">
            Day {post.dayNumber}
          </span>
        </div>
      ) : (
        <div className="aspect-[4/5] sm:aspect-[4/3] bg-[var(--card-2)] flex items-center justify-center">
          <p className="text-sm text-[var(--muted)] px-8 text-center line-clamp-6 whitespace-pre-wrap">{post.note}</p>
        </div>
      )}

      {/* challenge chip */}
      {challenge && (
        <div className="px-3 pt-3">
          <button
            onClick={() => navigate('challenge', challenge.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold hover:bg-[var(--brand)] hover:text-black transition-colors max-w-full"
            title={challenge.title}
          >
            <span>{cat?.emoji ?? '⚔️'}</span>
            <span className="line-clamp-1">{challenge.title}</span>
            <Icon name="arrowRight" size={11} />
          </button>
        </div>
      )}

      {/* description */}
      {post.mediaUrl && post.note && (
        <p className={`px-3.5 text-[13px] text-[var(--text)] leading-relaxed whitespace-pre-wrap ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {post.note}
        </p>
      )}

      {/* engagement */}
      <div className="p-3 pt-2.5 flex items-center gap-1">
        <EngagementBtn
          icon="heart"
          label={liked ? 'Unlike' : 'Like'}
          active={liked}
          count={post.likeCount}
          onClick={() => store.togglePostLike(post.id)}
        />
        <EngagementBtn icon="comment" label="Comments" count={post.commentCount} onClick={onOpen} />
        <EngagementBtn icon="bookmark" label={saved ? 'Unsave' : 'Save'} active={saved} count={post.saveCount} onClick={() => store.togglePostSave(post.id)} />
        <button
          onClick={() => store.sharePost(post.id)}
          className="ml-auto p-2 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card-2)] transition-colors"
          aria-label="Share post"
          title="Share post"
        >
          <Icon name="share" size={15} />
        </button>
      </div>
    </article>
  );
}

function EngagementBtn({
  icon,
  label,
  count,
  onClick,
  active = false,
}: {
  icon: string;
  label: string;
  count: number;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? 'text-[var(--brand)] bg-[var(--brand-soft)]' : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--card-2)]'
      }`}
    >
      <Icon name={icon} size={15} filled={active && icon === 'heart'} />
      {count > 0 ? compactCount(count) : ''}
    </button>
  );
}
