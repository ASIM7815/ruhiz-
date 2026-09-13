'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Post } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Badge, Modal, ModalHeader, GhostButton, PrimaryButton } from '@/components/ui/Primitives';
import { R2Image, R2Video } from '@/components/ui/Media';
import { timeAgo, compactCount } from '@/lib/format';
import { ME_ID, TOPICS } from '@/lib/data/sample';
import { getProblem } from '@/lib/recsys/problems';

export default function PostCard({ post, highlight = false, reason }: { post: Post; highlight?: boolean; reason?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const author = store.getUser(post.userId);
  const isOwn = post.userId === ME_ID;

  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [supportAnim, setSupportAnim] = useState(false);
  const [shareViaMessage, setShareViaMessage] = useState(false);

  const longText = post.text.length > 280;
  const displayText = longText && !expanded ? `${post.text.slice(0, 280).trimEnd()}…` : post.text;

  /* ---------- recommendation signals: view + watch tracking ---------- */
  const cardRef = useRef<HTMLElement | null>(null);
  const viewTrackedRef = useRef(false);
  const watchTrackedRef = useRef(false);
  const watchedSecondsRef = useRef(0);
  const playSessionRef = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || viewTrackedRef.current) return;
    let visibleSince = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            visibleSince = Date.now();
          } else if (visibleSince) {
            const dwell = Date.now() - visibleSince;
            visibleSince = 0;
            if (dwell >= 900 && !viewTrackedRef.current) {
              viewTrackedRef.current = true;
              store.trackActivity('view', { post });
            } else if (dwell < 900 && !viewTrackedRef.current) {
              // scrolled straight past — a soft negative signal
              store.trackActivity('ignore', { post, meta: { skipped: true } });
              viewTrackedRef.current = true;
            }
          }
        }
      },
      { threshold: [0.5] }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const onVideoTime = (t: number) => {
    if (playSessionRef.current) watchedSecondsRef.current = t;
  };
  const onVideoPlay = () => {
    playSessionRef.current = true;
  };
  const onVideoStop = () => {
    playSessionRef.current = false;
    maybeTrackWatch();
  };
  const maybeTrackWatch = () => {
    if (watchTrackedRef.current) return;
    if (watchedSecondsRef.current >= 3) {
      watchTrackedRef.current = true;
      store.trackActivity('watch', { post, meta: { seconds: Math.round(watchedSecondsRef.current) } });
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/feed#post-${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      store.toast('Link copied to clipboard');
    } catch {
      store.toast('Could not copy link', 'error');
    }
    setMenuOpen(false);
    setShareOpen(false);
  };

  const onSupport = () => {
    if (!post.supportedByMe) {
      setSupportAnim(true);
      window.setTimeout(() => setSupportAnim(false), 400);
    }
    store.toggleSupport(post.id);
    if (!post.supportedByMe) store.toast('You supported this moment 💚', 'info');
  };

  const dominantProblem = post.problems?.[0]?.id;

  return (
    <article
      ref={cardRef}
      id={`post-${post.id}`}
      className={`bg-[var(--card)] border rounded-2xl overflow-hidden transition-colors fade-in ${
        highlight ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/30' : 'border-[var(--border)]'
      }`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar user={author} size={44} onClick={() => navigate('profile', author.id)} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button onClick={() => navigate('profile', author.id)} className="font-semibold text-[var(--text)] hover:underline truncate">
                {author.name}
              </button>
              {author.verified && <Icon name="badge" size={15} className="text-[var(--brand)] flex-shrink-0" />}
              {isOwn && <Badge tone="muted">You</Badge>}
            </div>
            <p className="text-xs text-[var(--muted)] truncate">
              @{author.username} · {timeAgo(post.createdAt)}
              {post.type === 'question' && ' · Question'}
            </p>
          </div>
        </div>

        {/* Overflow menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-full hover:bg-[var(--card-2)] text-[var(--muted)] transition-colors"
            aria-label="Post options"
          >
            <Icon name="dots" size={20} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="pop-in absolute right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl py-1.5 w-56 z-20">
                <MenuBtn icon="link" label="Copy link" onClick={copyLink} />
                {isOwn ? (
                  <>
                    <MenuBtn icon="pen" label="Edit post" onClick={() => { setMenuOpen(false); setEditOpen(true); }} />
                    <MenuBtn icon="trash" label="Delete post" danger onClick={() => { setMenuOpen(false); setDeleteOpen(true); }} />
                  </>
                ) : (
                  <>
                    <MenuBtn
                      icon={store.isFollowing(author.id) ? 'close' : 'support'}
                      label={store.isFollowing(author.id) ? `Stop supporting @${author.username}` : `Support @${author.username}`}
                      onClick={() => {
                        store.toggleFollow(author.id);
                        store.toast(store.isFollowing(author.id) ? `Stopped supporting ${author.name}` : `You now support ${author.name} 💚`);
                        setMenuOpen(false);
                      }}
                    />
                    <MenuBtn
                      icon="eyeOff"
                      label="Not interested"
                      onClick={() => {
                        setMenuOpen(false);
                        store.hidePost(post.id, { problemId: dominantProblem, notInterested: true });
                        store.toast("Got it — we'll show you less like this", 'info');
                      }}
                    />
                    <MenuBtn
                      icon="close"
                      label="Hide this post"
                      onClick={() => {
                        setMenuOpen(false);
                        store.hidePost(post.id);
                      }}
                    />
                    <MenuBtn icon="flag" label="Report post" onClick={() => { setMenuOpen(false); setReportOpen(true); }} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 pb-4">
        {post.type === 'question' && (
          <div className="inline-flex items-center gap-1.5 mb-2 text-[var(--brand)] bg-[var(--brand-soft)] px-3 py-1 rounded-full text-xs font-semibold">
            <Icon name="spark" size={13} /> Asking the community
          </div>
        )}
        <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
        {longText && (
          <button onClick={() => setExpanded((v) => !v)} className="text-sm font-semibold text-[var(--brand)] mt-1 hover:underline">
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
        {post.problems && post.problems.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {post.problems.slice(0, 3).map((p) => {
              const cat = getProblem(p.id);
              if (!cat) return null;
              return (
                <span
                  key={p.id}
                  title="Understood by Ruhiz — people who care about this will see it sooner"
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--card-2)] text-[var(--muted)] text-[11px] font-medium rounded-full"
                >
                  <span aria-hidden>{cat.emoji}</span> {cat.label}
                </span>
              );
            })}
            {reason && (
              <span className="text-[11px] text-[var(--muted)] italic ml-1 hidden sm:inline">· {reason}</span>
            )}
          </div>
        )}
        {post.topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.topics.map((t) => (
              <button key={t} onClick={() => navigate('explore', t)} className="px-3 py-1 bg-[var(--brand-soft)] text-[var(--brand)] text-xs font-medium rounded-full hover:opacity-80 transition-opacity">
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Media */}
      {post.image && (
        <button onClick={() => setLightbox(true)} className="block w-full cursor-zoom-in group relative" aria-label="Open image">
          <R2Image mediaKey={post.image} alt="" className="w-full max-h-[520px] object-cover" />
        </button>
      )}
      {post.video && (
        <div className="px-4 sm:px-5 pb-4">
          <R2Video
            mediaKey={post.video}
            className="w-full rounded-xl bg-black max-h-[520px]"
            onPlay={onVideoPlay}
            onPause={onVideoStop}
            onEnded={() => {
              playSessionRef.current = false;
              watchTrackedRef.current = false;
              watchedSecondsRef.current = 999;
              maybeTrackWatch();
            }}
            onTimeUpdate={onVideoTime}
          />
        </div>
      )}

      {/* Actions — Support-first, no likes/hearts */}
      <div className="px-4 sm:px-5 py-3.5 border-t border-[var(--border)]">
        <div className="flex items-center gap-1 sm:gap-2">
          <ActionBtn
            icon="support"
            filled={post.supportedByMe}
            active={post.supportedByMe}
            label={compactCount(post.supports)}
            onClick={onSupport}
            className={supportAnim ? 'like-pop' : ''}
            title="Support — let them know you care"
          />
          <ActionBtn
            icon="footprints"
            filled={post.beenThere}
            active={post.beenThere}
            label={compactCount(post.beenThereCount)}
            onClick={() => {
              store.toggleBeenThere(post.id);
              if (!post.beenThere) store.toast('You told them you’ve been there 🫂', 'info');
            }}
            title="Been there — walk in their shoes"
          />
          <ActionBtn
            icon="comment"
            label={compactCount(post.commentCount || post.comments.length)}
            onClick={() => setCommentsOpen((v) => !v)}
            title="Comments"
          />

          {/* Share */}
          <div className="relative">
            <ActionBtn icon="share" label={compactCount(post.shares)} onClick={() => setShareOpen((v) => !v)} title="Share" />
            {shareOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShareOpen(false)} />
                <div className="pop-in absolute left-0 bottom-full mb-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl py-1.5 w-56 z-20">
                  <MenuBtn icon="link" label="Copy link" onClick={copyLink} />
                  <MenuBtn
                    icon="chat"
                    label="Send via message"
                    onClick={() => {
                      setShareOpen(false);
                      setShareViaMessage(true);
                    }}
                  />
                  <MenuBtn
                    icon="refresh"
                    label="Repost to your journey"
                    onClick={() => {
                      store.sharePost(post.id);
                      store.toast('Reposted to your journey ✨');
                      setShareOpen(false);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              store.toggleSave(post.id);
              store.toast(post.savedByMe ? 'Removed from Saved' : 'Saved to your collection 🔖', post.savedByMe ? 'info' : 'success');
            }}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              post.savedByMe ? 'text-[var(--brand)]' : 'text-[var(--muted)] hover:text-[var(--brand)]'
            }`}
            title="Save"
          >
            <Icon name="bookmark" size={20} filled={post.savedByMe} />
            <span className="hidden sm:inline text-sm font-medium">{post.savedByMe ? 'Saved' : 'Save'}</span>
          </button>
        </div>

        {/* Comments */}
        {commentsOpen && <CommentsBlock post={post} />}
      </div>

      {/* Modals */}
      {lightbox && post.image && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white" aria-label="Close image">
            <Icon name="close" size={26} />
          </button>
          <R2Image mediaKey={post.image} alt="" className="max-w-full max-h-[90vh] rounded-lg object-contain pop-in" />
        </div>
      )}

      {editOpen && <EditPostModal post={post} onClose={() => setEditOpen(false)} />}
      {deleteOpen && (
        <ConfirmModal
          title="Delete this moment?"
          body="This will permanently remove the moment from Ruhiz. This can't be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            void store.deletePost(post.id);
            store.toast('Moment deleted');
          }}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {reportOpen && (
        <ConfirmModal
          title="Report this moment?"
          body="Our care team will review it. If it breaks Ruhiz's kindness guidelines, it will be removed. Thank you for keeping this space safe."
          confirmLabel="Report"
          onConfirm={() => store.toast('Thanks — our care team will review this report', 'info')}
          onClose={() => setReportOpen(false)}
        />
      )}
      <MessageShareModal open={shareViaMessage} postId={post.id} onClose={() => setShareViaMessage(false)} />
    </article>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  filled = false,
  active = false,
  title,
  className = '',
}: {
  icon: string;
  label?: string;
  onClick: () => void;
  filled?: boolean;
  active?: boolean;
  title: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
        active ? 'text-[var(--brand)]' : 'text-[var(--muted)] hover:text-[var(--brand)] hover:bg-[var(--card-2)]'
      } ${className}`}
    >
      <Icon name={icon} size={20} filled={filled} />
      {label !== undefined && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

function MenuBtn({ icon, label, onClick, danger = false }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm font-medium transition-colors ${
        danger ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)]' : 'text-[var(--text)] hover:bg-[var(--card-2)]'
      }`}
    >
      <Icon name={icon} size={16} className={danger ? '' : 'text-[var(--muted)]'} />
      {label}
    </button>
  );
}

function CommentsBlock({ post }: { post: Post }) {
  const store = useStore();
  const { navigate } = useNav();
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    store.addComment(post.id, text);
    setDraft('');
  };

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
      {post.comments.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-2">No comments yet — be the first to be kind 💚</p>}
      {post.comments.map((c) => {
        const author = store.getUser(c.userId);
        return (
          <div key={c.id} className="flex gap-3 fade-in">
            <Avatar user={author} size={32} onClick={() => navigate('profile', author.id)} />
            <div className="flex-1 min-w-0">
              <div className="bg-[var(--card-2)] rounded-2xl px-4 py-2.5 inline-block max-w-full">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-xs text-[var(--text)]">{author.name}</p>
                  <p className="text-[10px] text-[var(--muted)]">{timeAgo(c.createdAt)}</p>
                </div>
                <p className="text-sm text-[var(--text)] break-words">{c.text}</p>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex gap-3 items-center">
        <Avatar user={store.me} size={32} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Write a kind comment…"
          className="flex-1 px-4 py-2.5 bg-[var(--card-2)] rounded-full text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 placeholder:text-[var(--muted)]"
        />
        <button onClick={submit} disabled={!draft.trim()} className="p-2.5 rounded-full bg-[var(--brand)] text-white disabled:opacity-40 hover:bg-[var(--brand-dark)] transition-colors" aria-label="Send comment">
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Confirm modal --------------------------- */

export function ConfirmModal({
  title,
  body,
  confirmLabel = 'Confirm',
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal open onClose={onClose} maxWidth="max-w-sm">
      <div className="p-6">
        <h3 className="text-lg font-bold text-[var(--text)] mb-2">{title}</h3>
        {body && <p className="text-sm text-[var(--muted)] leading-relaxed mb-2">{body}</p>}
        {children}
        <div className="flex gap-3 mt-5">
          <GhostButton onClick={onClose} className="flex-1">
            Cancel
          </GhostButton>
          <button
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--brand)] hover:bg-[var(--brand-dark)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------- Edit post modal ------------------------ */

function EditPostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const store = useStore();
  const [text, setText] = useState(post.text);
  const [topics, setTopics] = useState<string[]>(post.topics);

  const toggleTopic = (t: string) =>
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4)));

  return (
    <Modal open onClose={onClose} maxWidth="max-w-xl">
      <ModalHeader title="Edit moment" onClose={onClose} />
      <div className="p-6 space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 resize-none"
        />
        <div>
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Topics</p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTopic(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  topics.includes(t) ? 'bg-[var(--brand)] text-white' : 'bg-[var(--card-2)] text-[var(--muted)] hover:bg-[var(--border)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton
            disabled={!text.trim()}
            onClick={() => {
              void store.updatePost(post.id, { text: text.trim(), topics });
              store.toast('Moment updated');
              onClose();
            }}
          >
            Save changes
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------- Share via message ------------------------- */

function MessageShareModal({ open, postId, onClose }: { open: boolean; postId: string; onClose: () => void }) {
  const store = useStore();
  const { navigate } = useNav();
  const threads = useMemo(() => store.threads, [store.threads]);

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md">
      <ModalHeader title="Send via message" subtitle="Share this moment with someone you support" onClose={onClose} />
      <div className="p-3 max-h-80 overflow-y-auto">
        {threads.map((t) => {
          const u = store.getUser(t.userId);
          return (
            <button
              key={t.id}
              onClick={() => {
                store.sharePost(postId, t.id);
                store.toast(`Shared with ${u.name} 💌`);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--card-2)] transition-colors text-left"
            >
              <Avatar user={u} size={40} />
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-sm text-[var(--text)] truncate">{u.name}</span>
                <span className="block text-xs text-[var(--muted)] truncate">{t.messages.at(-1)?.text ?? 'Start a conversation'}</span>
              </span>
              <Icon name="send" size={16} className="text-[var(--brand)]" />
            </button>
          );
        })}
        {threads.length === 0 && <p className="text-sm text-[var(--muted)] text-center py-6">No conversations yet.</p>}
      </div>
      <div className="px-6 pb-5">
        <GhostButton className="w-full" onClick={() => { onClose(); navigate('messages'); }}>
          Go to Messages
        </GhostButton>
      </div>
    </Modal>
  );
}
