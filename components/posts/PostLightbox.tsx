'use client';

import { useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Modal, ModalHeader } from '@/components/ui/Primitives';
import { R2Image, R2Video } from '@/components/ui/Media';
import { compactCount, fullDate, timeAgo } from '@/lib/format';
import type { ChallengePost } from '@/lib/duel/types';

/**
 * Full-resolution view of a single progress post: media, creator, the
 * challenge it belongs to (click → challenge page), description, day,
 * timestamp, real engagement and its comment thread.
 */
export default function PostLightbox({
  post,
  onClose,
  onEdit,
}: {
  post: ChallengePost;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const store = useStore();
  const { navigate } = useNav();
  const author = store.getUser(post.userId);
  const challenge = store.db.challenges.find((c) => c.id === post.challengeId);
  const category = challenge ? store.categories.find((c) => c.id === challenge.categoryId) : undefined;
  const isMine = post.userId === store.db.meId;
  const liked = store.hasLikedPost(post.id);
  const saved = store.hasSavedPost(post.id);
  const comments = store.postCommentsFor(post.id);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const submitComment = async () => {
    const text = draft.trim();
    if (!text) return;
    const ok = await store.addPostComment(post.id, text);
    if (ok) setDraft('');
  };

  return (
    <Modal open={true} onClose={onClose} labelledBy="post-detail" maxWidth="max-w-2xl">
      <ModalHeader
        title={`Day ${post.dayNumber}${challenge ? ` of ${challenge.durationDays}` : ''}`}
        onClose={onClose}
        subtitle={challenge?.title ?? 'Challenge post'}
      />
      <div className="p-4 sm:p-5 space-y-4 max-h-[78vh] overflow-y-auto">
        {/* media */}
        {post.mediaUrl && (
          <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[50vh]">
            {post.mediaType === 'video' ? (
              <R2Video mediaKey={post.mediaUrl} controls autoPlay className="w-full max-h-[50vh] object-contain" />
            ) : (
              <R2Image mediaKey={post.mediaUrl} alt={`Day ${post.dayNumber} proof`} className="w-full max-h-[50vh] object-contain" />
            )}
          </div>
        )}

        {/* author + menu */}
        <div className="flex items-center gap-3">
          <Avatar user={author} size={40} onClick={() => { onClose(); navigate('profile', author.id); }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text)] flex items-center gap-1.5">
              {author.name}
              {author.verified && <Icon name="badge" size={13} className="text-[var(--brand)]" />}
            </p>
            <p className="text-xs text-[var(--muted)]">
              @{author.username} · {fullDate(post.date || post.createdAt)}
            </p>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded-lg text-[var(--muted)] hover:bg-[var(--card-2)]" aria-label="Post menu">
              <Icon name="dots" size={16} />
            </button>
            {menuOpen && (
              <div className="pop-in absolute right-0 top-full mt-1 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-20 overflow-hidden">
                {challenge && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onClose();
                      navigate('challenge', challenge.id);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                  >
                    <Icon name="swords" size={14} className="text-[var(--muted)]" /> View challenge
                  </button>
                )}
                {isMine && onEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onClose();
                      onEdit();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--card-2)] flex items-center gap-2"
                  >
                    <Icon name="edit" size={14} className="text-[var(--muted)]" /> Edit post
                  </button>
                )}
                {isMine && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (window.confirm('Delete this post? Your progress for this day will be recomputed.')) {
                        void store.deletePost(post.id);
                        onClose();
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

        {/* challenge chip */}
        {challenge && (
          <button
            onClick={() => {
              onClose();
              navigate('challenge', challenge.id);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--card-2)] hover:bg-[var(--brand-soft)] transition-colors text-left"
          >
            <span>{category?.emoji ?? '⚔️'}</span>
            <span className="text-xs font-semibold text-[var(--text)] flex-1 truncate">{challenge.title}</span>
            <span className="text-[11px] font-bold text-[var(--brand)] flex items-center gap-1">
              View Challenge <Icon name="arrowRight" size={12} />
            </span>
          </button>
        )}

        {/* description */}
        {post.note && (
          <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{post.note}</p>
        )}

        {/* engagement bar */}
        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <ActionBtn
            icon="heart"
            label={liked ? 'Unlike' : 'Like'}
            active={liked}
            count={post.likeCount}
            onClick={() => store.togglePostLike(post.id)}
          />
          <ActionBtn icon="comment" label="Comments" count={post.commentCount} onClick={() => {}} />
          <ActionBtn
            icon="bookmark"
            label={saved ? 'Unsave' : 'Save'}
            active={saved}
            count={post.saveCount}
            onClick={() => store.togglePostSave(post.id)}
          />
          <ActionBtn icon="share" label="Share" count={post.shareCount} onClick={() => store.sharePost(post.id)} />
        </div>

        {/* comments */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Comments ({comments.length})
          </p>
          {comments.map((c) => {
            const u = store.getUser(c.userId);
            const mine = c.userId === store.db.meId;
            return (
              <div key={c.id} className="flex items-start gap-2.5">
                <Avatar user={u} size={30} onClick={() => { onClose(); navigate('profile', u.id); }} />
                <div className="flex-1 min-w-0 bg-[var(--card-2)] rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                    {u.name}
                    <span className="text-[10px] font-normal text-[var(--muted)]">{timeAgo(c.createdAt)}</span>
                    {mine && (
                      <button
                        onClick={() => store.deletePostComment(c.id)}
                        className="ml-auto text-[10px] text-[var(--muted)] hover:text-[var(--danger)]"
                        title="Delete comment"
                      >
                        delete
                      </button>
                    )}
                  </p>
                  <p className="text-[13px] text-[var(--text)] mt-0.5 whitespace-pre-wrap">{c.text}</p>
                </div>
              </div>
            );
          })}
          {comments.length === 0 && (
            <p className="text-xs text-[var(--muted)]">No comments yet — say something encouraging.</p>
          )}
          {store.me && (
            <div className="flex items-center gap-2">
              <Avatar user={store.me} size={30} />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                className="flex-1 bg-[var(--card-2)] border border-[var(--border)] rounded-full px-4 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
              <button
                onClick={submitComment}
                disabled={!draft.trim()}
                className="px-3.5 py-2 rounded-full bg-[var(--brand)] text-black text-xs font-bold disabled:opacity-40 transition-opacity"
              >
                Post
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ActionBtn({
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
