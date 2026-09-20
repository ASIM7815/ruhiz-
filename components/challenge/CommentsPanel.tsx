'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Avatar, Spinner } from '@/components/ui/Primitives';
import { timeAgo } from '@/lib/format';

export default function CommentsPanel({ challengeId }: { challengeId: string }) {
  const { db, getUser, addComment, deleteComment } = useStore();
  const { navigate } = useNav();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const comments = useMemo(
    () => db.comments.filter((c) => c.challengeId === challengeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [db.comments, challengeId]
  );

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const ok = await addComment(challengeId, body);
    setBusy(false);
    if (ok) setText('');
  };

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5">
      <h3 className="display text-sm text-[var(--text)] mb-4 flex items-center gap-2">
        <Icon name="comment" size={16} className="text-[var(--brand)]" /> Comments ({comments.length})
      </h3>

      <div className="flex gap-3 mb-5">
        <Avatar user={getUser(db.meId ?? '')} size={38} />
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Share progress, ask a question, cheer someone on…"
            aria-label="Write a comment"
            className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={submit}
              disabled={busy || !text.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--brand)] text-black text-xs font-bold hover:bg-[var(--brand-dark)] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Spinner size={13} /> : <Icon name="send" size={13} />} Comment
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {comments.length === 0 && <p className="text-sm text-[var(--muted)]">No comments yet — start the conversation.</p>}
        {comments.map((c) => {
          const u = getUser(c.userId);
          return (
            <div key={c.id} className="flex gap-3 group">
              <Avatar user={u} size={36} onClick={() => navigate('profile', c.userId)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate('profile', c.userId)} className="text-sm font-semibold text-[var(--text)] hover:text-[var(--brand)]">
                    {u.name}
                  </button>
                  <span className="text-[11px] text-[var(--muted)]">{timeAgo(c.createdAt)}</span>
                  {c.userId === db.meId && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="ml-auto text-[11px] text-[var(--muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete comment"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-[var(--text)] leading-relaxed mt-0.5 break-words">{c.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
