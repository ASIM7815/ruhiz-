'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Modal, Spinner } from '@/components/ui/Primitives';
import { R2Image, R2Video } from '@/components/ui/Media';
import { compactCount, fullDate, timeAgo } from '@/lib/format';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import type { FeedPost, PostComment } from '@/lib/duel/types';

/* ------------------------------- grid tile ------------------------------- */

export function PostCard({
  post,
  onOpen,
}: {
  post: FeedPost;
  onOpen: (post: FeedPost) => void;
}) {
  return (
    <button
      onClick={() => onOpen(post)}
      className="group relative w-full aspect-[9/14] rounded-2xl overflow-hidden bg-[var(--card-2)] border border-[var(--border)] hover:border-[var(--brand)]/50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      aria-label={`Post by @${post.authorUsername} — ${post.challengeTitle}, day ${post.dayNumber}`}
    >
      {post.mediaUrl && post.mediaType === 'video' ? (
        <video
          src={post.mediaUrl}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
        />
      ) : post.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.mediaUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        /* written entry — no photo/video attached */
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-soft)] via-[var(--card-2)] to-black/60 flex flex-col justify-center p-4">
          <Icon name="pen" size={20} className="text-[var(--brand)] mb-2" />
          <p className="text-[13px] leading-relaxed text-[var(--text)] line-clamp-[8] whitespace-pre-wrap">
            {post.note || 'Progress logged.'}
          </p>
        </div>
      )}

      {/* gradient + overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/35 pointer-events-none" />

      <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-white text-[11px] font-bold display flex items-center gap-1">
        <Icon name="calendar" size={11} className="text-[var(--brand)]" /> DAY {post.dayNumber}
      </span>
      {post.mediaType === 'video' && (
        <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 backdrop-blur flex items-center justify-center">
          <Icon name="play" size={13} className="text-[var(--brand)]" />
        </span>
      )}

      <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col gap-1.5">
        <span className="text-[12px] font-bold text-white truncate flex items-center gap-1.5">
          <Icon name="swords" size={12} className="text-[var(--brand)] flex-shrink-0" />
          <span className="truncate">{post.challengeTitle}</span>
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/85 truncate">@{post.authorUsername}</span>
          <span className="flex items-center gap-2 text-[11px] font-semibold text-white/90 flex-shrink-0">
            <span className="flex items-center gap-1">
              <Icon name="heart" size={12} filled={post.iLiked} className={post.iLiked ? 'text-[var(--brand)]' : ''} />
              {compactCount(post.likeCount)}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="comment" size={12} />
              {compactCount(post.commentCount)}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------- lightbox -------------------------------- */

export function PostLightbox({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const store = useStore();
  const { navigate } = useNav();

  const [liked, setLiked] = useState(post.iLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setLiked(post.iLiked);
    setLikeCount(post.likeCount);
  }, [post.id, post.iLiked, post.likeCount]);

  useEffect(() => {
    let alive = true;
    setComments(null);
    store
      .loadPostComments(post.id)
      .then((rows) => {
        if (alive) setComments(rows);
      })
      .catch(() => {
        if (alive) setComments([]);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const onToggleLike = useCallback(async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const real = await store.togglePostLike(post.id);
      setLiked(real);
      setLikeCount((n) => Math.max(0, n + (real === next ? 0 : real ? 1 : -1)));
    } catch {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
    } finally {
      setLikeBusy(false);
    }
  }, [likeBusy, liked, post.id, store]);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    const created = await store.addPostComment(post.id, text);
    if (created) {
      setComments((rows) => [...(rows ?? []), created]);
      setDraft('');
    }
    setPosting(false);
  }, [draft, posting, post.id, store]);

  const author = store.getUser(post.authorId);
  const authorAvatar = { name: post.authorName, avatar: post.authorAvatar, avatarHue: author?.avatarHue };

  return (
    <Modal open onClose={onClose} maxWidth="max-w-5xl">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center hover:bg-black/80 transition-colors"
          aria-label="Close"
        >
          <Icon name="close" size={18} />
        </button>
        <div className="grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-0 md:max-h-[85vh]">
        {/* media */}
        <div className="relative bg-black rounded-t-2xl md:rounded-t-none md:rounded-l-2xl overflow-hidden flex items-center justify-center min-h-[280px] md:min-h-[520px]">
          {post.mediaUrl ? (
            post.mediaType === 'video' ? (
              <R2Video mediaKey={post.mediaUrl} controls autoPlay className="w-full h-full max-h-[85vh] object-contain" />
            ) : (
              <R2Image mediaKey={post.mediaUrl} alt={post.note || post.challengeTitle} className="w-full h-full max-h-[85vh] object-contain" />
            )
          ) : (
            /* written entry — no photo/video attached */
            <div className="w-full h-full min-h-[280px] md:min-h-[520px] flex flex-col justify-center gap-4 p-8 bg-gradient-to-br from-[var(--brand-soft)] via-black/40 to-black/80">
              <Icon name="pen" size={28} className="text-[var(--brand)]" />
              <p className="text-[15px] leading-relaxed text-white/95 whitespace-pre-wrap break-words">
                {post.note || 'Progress logged.'}
              </p>
            </div>
          )}
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-white text-[12px] font-bold display flex items-center gap-1.5">
            <Icon name="calendar" size={12} className="text-[var(--brand)]" /> DAY {post.dayNumber}
            <span className="text-white/50 font-sans font-medium">/ {post.durationDays}</span>
          </span>
        </div>

        {/* side panel */}
        <div className="flex flex-col min-h-0 max-h-[60vh] md:max-h-[85vh]">
          <div className="flex items-center gap-3 p-4 border-b border-[var(--border)]">
            <button onClick={() => { onClose(); navigate('profile', post.authorId); }} className="flex items-center gap-3 min-w-0 text-left group">
              <Avatar user={authorAvatar} size={38} />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[var(--text)] truncate group-hover:text-[var(--brand)] transition-colors">
                  {post.authorName}
                </span>
                <span className="block text-[11px] text-[var(--muted)] truncate">@{post.authorUsername}</span>
              </span>
            </button>
            <button
              onClick={() => { onClose(); navigate('challenge', post.challengeId); }}
              className="ml-auto flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold hover:bg-[var(--brand)] hover:text-black transition-colors flex items-center gap-1.5"
              title="View challenge"
            >
              <Icon name="swords" size={12} />
              <span className="truncate max-w-[130px]">{post.challengeTitle}</span>
            </button>
          </div>

          <div className="px-4 py-3 border-b border-[var(--border)] text-[13px] text-[var(--text)] leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {post.note || <span className="text-[var(--muted)]">No caption.</span>}
            <span className="block mt-1.5 text-[11px] text-[var(--muted)]">
              {post.categoryEmoji} {post.categoryName} · {fullDate(post.date)} · {timeAgo(post.createdAt)}
            </span>
          </div>

          {/* comments */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
            {comments === null ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : comments.length === 0 ? (
              <p className="text-[12px] text-[var(--muted)] text-center py-6">
                No comments yet{store.authed ? ' — start the conversation.' : '.'}
              </p>
            ) : (
              comments.map((cm) => {
                const u = store.getUser(cm.userId);
                return (
                  <div key={cm.id} className="flex items-start gap-2.5">
                    <button onClick={() => { onClose(); navigate('profile', cm.userId); }} className="flex-shrink-0 mt-0.5">
                      <Avatar user={{ name: u?.name ?? 'Member', avatar: u?.avatar ?? null, avatarHue: u?.avatarHue }} size={26} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-[12px] leading-relaxed text-[var(--text)] break-words">
                        <button
                          onClick={() => { onClose(); navigate('profile', cm.userId); }}
                          className="font-bold hover:text-[var(--brand)] transition-colors"
                        >
                          @{u?.username ?? 'member'}
                        </button>{' '}
                        {cm.text}
                      </p>
                      <span className="text-[10px] text-[var(--muted)]">{timeAgo(cm.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* actions */}
          <div className="border-t border-[var(--border)] p-3 space-y-2">
            <div className="flex items-center gap-4">
              <button
                onClick={onToggleLike}
                disabled={likeBusy}
                className={`flex items-center gap-1.5 text-[13px] font-bold transition-colors ${liked ? 'text-[var(--brand)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                <Icon name="heart" size={18} filled={liked} className={liked ? 'like-pop' : ''} />
                {compactCount(likeCount)}
              </button>
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--muted)]">
                <Icon name="comment" size={17} />
                {compactCount(comments?.length ?? post.commentCount)}
              </span>
            </div>
            {store.authed ? (
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onSend();
                  }}
                  placeholder="Add a comment…"
                  maxLength={1000}
                  className="flex-1 bg-[var(--card-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand)]"
                />
                <button
                  onClick={() => void onSend()}
                  disabled={!draft.trim() || posting}
                  className="p-2 rounded-lg bg-[var(--brand)] text-black disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send comment"
                >
                  {posting ? <Spinner size={16} className="text-black" /> : <Icon name="send" size={16} />}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--muted)]">Sign in to like and comment.</p>
            )}
          </div>
        </div>
      </div>
      </div>
    </Modal>
  );
}
