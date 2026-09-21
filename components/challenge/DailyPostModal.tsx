'use client';

/**
 * DailyPostModal — the single write path for Challenge → Participants → Daily Posts → Media.
 * Replaces the old CheckinModal + CreatePostModal (which wrote to two different systems).
 * Submits through `duel_submit_daily_post` (RPC) — the DB owns day/date/eligibility rules.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icons';
import { Modal, PrimaryButton, Spinner } from '@/components/ui/Primitives';
import { deleteMedia, uploadMedia, validateUpload, type UploadResult } from '@/lib/upload';
import { useStore } from '@/lib/duel/store';
import type { FeedPost, PostMediaInput } from '@/lib/duel/types';

interface DraftItem {
  id: string;
  file?: File;
  previewUrl?: string;
  kind: 'image' | 'video';
  status: 'uploading' | 'done' | 'error';
  progress: number;
  result?: UploadResult;
  /** For pre-existing media in edit mode: the stored key + metadata. */
  existing?: { url: string; type: 'image' | 'video'; thumbnailUrl?: string | null; width?: number | null; height?: number | null };
  error?: string;
}

export default function DailyPostModal({
  open,
  onClose,
  challengeId,
  challengeTitle,
  durationDays,
  dayNumber,
  existing,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  challengeId: string;
  challengeTitle?: string;
  durationDays: number;
  /** Preferred day slot; the user can adjust within 1..durationDays. */
  dayNumber?: number | null;
  /** Existing post to edit (caption + media replace-as-set). */
  existing?: FeedPost | null;
  onPosted?: () => void;
}) {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [day, setDay] = useState(() => Math.min(Math.max(dayNumber ?? existing?.dayNumber ?? 1, 1), durationDays));
  const [caption, setCaption] = useState(existing?.note ?? '');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Seed edit-mode media
  useEffect(() => {
    if (!open) return;
    setDay(Math.min(Math.max(dayNumber ?? existing?.dayNumber ?? 1, 1), durationDays));
    setCaption(existing?.note ?? '');
    setSubmitError(null);
    setItems(
      (existing?.media ?? []).map((m, i) => ({
        id: `existing-${i}-${m.url}`,
        kind: m.mediaType === 'video' ? 'video' : 'image',
        status: 'done' as const,
        progress: 100,
        previewUrl: m.mediaType === 'video' ? undefined : m.url,
        existing: { url: m.url, type: m.mediaType, thumbnailUrl: m.thumbnailUrl, width: m.width, height: m.height },
      }))
    );
  }, [open, dayNumber, existing]);

  const uploading = items.some((it) => it.status === 'uploading');
  const hasContent = caption.trim().length > 0 || items.some((it) => it.status === 'done');

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const err = validateUpload(file, file.type.startsWith('video/') ? 'post-video' : 'post-image');
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
      if (err) {
        setItems((prev) => [...prev, { id, file, kind, status: 'error', progress: 0, error: err }]);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const item: DraftItem = { id, file, previewUrl, kind, status: 'uploading', progress: 0 };
      setItems((prev) => [...prev, item]);
      void uploadOne(item);
    }
  };

  const uploadOne = async (item: DraftItem) => {
    if (!item.file) return;
    try {
      const res = await uploadMedia(item.file, {
        kind: item.kind === 'video' ? 'post-video' : 'post-image',
        onProgress: (pct) =>
          setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, progress: pct } : it))),
      });
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'done', result: res, progress: 100 } : it)));
    } catch (e: any) {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: e?.message ?? 'Upload failed.' } : it))
      );
    }
  };

  const retryItem = (item: DraftItem) => {
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', progress: 0, error: undefined } : it)));
    void uploadOne({ ...item, status: 'uploading' });
  };

  const removeItem = (item: DraftItem) => {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  };

  const submit = async () => {
    if (submitting || uploading) return;
    const failed = items.some((it) => it.status === 'error');
    if (failed) {
      setSubmitError('Remove or retry the failed uploads first.');
      return;
    }
    if (!hasContent) {
      setSubmitError('Add a description or at least one photo/video.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const media: PostMediaInput[] | null = items.length === 0 && !existing ? null : items.map((it) => {
      if (it.existing) {
        return {
          type: it.existing.type,
          url: it.existing.url,
          thumbnailUrl: it.existing.thumbnailUrl ?? undefined,
          width: it.existing.width ?? undefined,
          height: it.existing.height ?? undefined,
        };
      }
      return { type: it.kind, url: it.result!.key };
    });

    // `duel_submit_daily_post` upserts on (challenge, user, day) — edit = resubmit.
    const ok = await store.submitDailyPost({
      challengeId,
      dayNumber: existing ? existing.dayNumber : day,
      caption: caption.trim(),
      media,
    });

    setSubmitting(false);
    if (!ok) {
      setSubmitError(existing ? 'Could not save changes.' : 'Could not publish your day post.');
      return;
    }

    // Clean up media the user removed during an edit (best-effort; RLS/storage
    // ownership rules make it safe even if this runs late).
    if (existing) {
      const kept = new Set(items.filter((it) => it.existing).map((it) => it.existing!.url));
      for (const m of existing.media ?? []) {
        if (!kept.has(m.url)) void deleteMedia(m.url).catch(() => {});
      }
    }

    for (const it of items) {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    }
    setItems([]);
    setCaption('');
    onPosted?.();
    onClose();
  };

  const dayHint = useMemo(() => {
    if (existing) return 'Editing an existing day post.';
    return day === 1 ? 'Day 1 — the duel starts here.' : `Day ${day} of ${durationDays}.`;
  }, [day, durationDays, existing]);

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="display text-xl text-[var(--text)]">{existing ? 'Edit day post' : 'Post your day'}</h2>
            {challengeTitle && (
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-[240px]">{challengeTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--card-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Day selector */}
        {!existing && (
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block mb-1.5">Day</label>
            <div className="flex items-center gap-2">
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="bg-[var(--card-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)]"
              >
                {Array.from({ length: durationDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Day {d}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--muted)]">{dayHint}</span>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block mb-1.5">Description</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What did you do today? Any lesson worth carrying?"
            className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand)] resize-none"
          />
        </div>

        {/* Media picker */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block mb-1.5">
            Photos &amp; videos <span className="normal-case font-medium">(up to 300 MB per video)</span>
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)] hover:border-[var(--brand)]/50'
            }`}
          >
            <Icon name="plus" size={18} className="text-[var(--brand)] mx-auto mb-1" />
            <p className="text-xs text-[var(--muted)]">Click or drop images/videos here</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 bg-[var(--card-2)] border border-[var(--border)] rounded-xl p-2.5"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center">
                  {it.kind === 'video' ? (
                    <Icon name="play" size={16} className="text-[var(--brand)]" />
                  ) : it.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="image" size={16} className="text-[var(--muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">
                    {it.file?.name ?? `${it.kind} (saved)`}
                    {it.file && <span className="text-[var(--muted)] font-normal"> · {Math.round(it.file.size / 1024 / 1024 * 10) / 10} MB</span>}
                  </p>
                  {it.status === 'uploading' && (
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                      <div className="h-full bg-[var(--brand)] transition-all" style={{ width: `${it.progress}%` }} />
                    </div>
                  )}
                  {it.status === 'error' && <p className="text-[11px] text-red-400 mt-0.5 truncate">{it.error}</p>}
                  {it.status === 'done' && <p className="text-[11px] text-emerald-400 mt-0.5">Uploaded ✓</p>}
                </div>
                {it.status === 'error' && (
                  <button
                    onClick={() => retryItem(it)}
                    className="text-[11px] font-bold text-[var(--brand)] px-2 py-1 rounded-lg hover:bg-[var(--brand-soft)]"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => removeItem(it)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10"
                  aria-label="Remove"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {submitError && (
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">{submitError}</p>
        )}

        <PrimaryButton onClick={() => void submit()} disabled={submitting || uploading || !hasContent} className="w-full">
          {submitting ? (
            <Spinner size={16} className="text-black" />
          ) : uploading ? (
            'Uploading media…'
          ) : existing ? (
            'Save changes'
          ) : (
            `Publish Day ${day}`
          )}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
