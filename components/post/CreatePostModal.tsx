'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from '@/components/ui/Icons';
import { Modal, ModalHeader, Spinner } from '@/components/ui/Primitives';
import { uploadMedia, fileToDataURL, UPLOAD_LIMITS } from '@/lib/upload';
import { TOPICS } from '@/lib/data/sample';
import type { PostType } from '@/lib/types';
import { formatBytes } from '@/lib/format';
import { classifyPost } from '@/lib/recsys/classifier';
import { getProblem } from '@/lib/recsys/problems';

interface Props {
  open: boolean;
  initialTab?: Exclude<PostType, 'question'> | null;
  onClose: () => void;
}

export default function CreatePostModal({ open, initialTab, onClose }: Props) {
  const store = useStore();
  const [tab, setTab] = useState<'photo' | 'video' | 'moment' | null>(null);

  const activeTab = tab ?? (initialTab as 'photo' | 'video' | 'moment' | null) ?? null;

  const close = () => {
    setTab(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} maxWidth="max-w-2xl">
      <ModalHeader
        title={activeTab ? { photo: 'Share a photo', video: 'Share a video', moment: 'Write a moment' }[activeTab] : 'Create a post'}
        subtitle={activeTab ? undefined : 'What do you want to share today?'}
        onClose={close}
      />
      <div className="p-6">
        {!activeTab ? (
          <TypePicker onPick={(t) => setTab(t)} />
        ) : (
          <Composer
            key={activeTab}
            type={activeTab}
            onBack={() => setTab(null)}
            onSwitch={(t) => setTab(t)}
            onClose={close}
          />
        )}
      </div>
    </Modal>
  );
}

function TypePicker({ onPick }: { onPick: (t: 'photo' | 'video' | 'moment') => void }) {
  const options: { id: 'photo' | 'video' | 'moment'; icon: string; title: string; desc: string; cls: string }[] = [
    { id: 'photo', icon: 'image', title: 'Photo', desc: 'Capture the moment', cls: 'from-sky-500/15 to-cyan-500/10' },
    { id: 'video', icon: 'video', title: 'Video', desc: 'Share a vibe', cls: 'from-purple-500/15 to-pink-500/10' },
    { id: 'moment', icon: 'pen', title: 'Moment', desc: 'Write your story', cls: 'from-emerald-500/15 to-green-500/10' },
  ];
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={`group rounded-2xl border-2 border-[var(--border)] hover:border-[var(--brand)] bg-gradient-to-br ${o.cls} p-6 text-center transition-all hover:shadow-lg`}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--brand)] text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <Icon name={o.icon} size={26} />
            </div>
            <h3 className="font-bold text-[var(--text)]">{o.title}</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">{o.desc}</p>
          </button>
        ))}
      </div>
      <div className="mt-6 p-4 bg-[var(--brand-soft)] rounded-2xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[var(--card)] flex items-center justify-center flex-shrink-0 text-[var(--brand)]">
          <Icon name="shield" size={18} />
        </div>
        <div>
          <h4 className="font-semibold text-sm text-[var(--text)]">Safe Space Reminder</h4>
          <p className="text-xs text-[var(--muted)] leading-relaxed mt-0.5">
            Share authentically — your mental health matters. Uploads go to Cloudflare R2 once connected, and posts sync to your Supabase feed.
          </p>
        </div>
      </div>
    </>
  );
}

function Composer({
  type,
  onBack,
  onSwitch,
  onClose,
}: {
  type: 'photo' | 'video' | 'moment';
  onBack: () => void;
  onSwitch: (t: 'photo' | 'video' | 'moment') => void;
  onClose: () => void;
}) {
  const store = useStore();
  const [text, setText] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const classified = useMemo(
    () => classifyPost(text, topics).map((p) => getProblem(p.id)).filter(Boolean) as { id: string; label: string; emoji: string }[],
    [text, topics]
  );

  // Same allow-list the upload pipeline enforces — previously the picker said
  // 50 MB while /api/upload/presign allowed 300 MB and omitted video/x-m4v, so
  // files could be rejected after the member had already waited on a progress bar.
  const limits = UPLOAD_LIMITS[type === 'video' ? 'post-video' : 'post-image'];
  const maxMB = limits.maxMB;
  const accept = limits.mimes.join(',');

  const pickFile = async (f: File) => {
    setError('');
    const isVideo = type === 'video';
    if (isVideo && !f.type.startsWith('video/')) return setError('Please choose a video file (MP4, MOV or WebM).');
    if (!isVideo && !f.type.startsWith('image/')) return setError('Please choose an image file.');
    if (f.size > maxMB * 1024 * 1024) return setError(`File too large — max ${maxMB} MB.`);
    setFile(f);
    if (isVideo) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(await fileToDataURL(f));
    }
  };

  const toggleTopic = (t: string) =>
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 4)));

  const canPost = text.trim().length > 0 && (type === 'moment' || file);

  const submit = async () => {
    if (!canPost || uploading) return;
    setUploading(true);
    setProgress(5);
    try {
      let mediaKey: string | undefined;
      let storage = 'local';
      if (file) {
        const res = await uploadMedia(file, type === 'video' ? 'post-video' : 'post-image', setProgress);
        mediaKey = res.key;
        storage = res.storage;
      }
      setProgress(95);
      await store.createPost({
        type,
        text: text.trim(),
        image: type === 'photo' ? mediaKey : undefined,
        video: type === 'video' ? mediaKey : undefined,
        topics,
      });
      store.toast(
        type === 'moment'
          ? 'Your moment is live ✨'
          : storage === 'r2'
          ? 'Uploaded to R2 and posted ✨'
          : 'Posted! (demo storage — connect R2 for permanent hosting)',
        storage === 'r2' ? 'success' : 'success'
      );
      onClose();
    } catch (err) {
      // uploadMedia/createPost throw plain Errors carrying copy that is already
      // safe to show. Anything unexpected still gets the generic message, so
      // internals never leak into the UI.
      const message = err instanceof Error && err.message ? err.message : '';
      store.toast(message || 'Something went wrong while posting', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Type switcher */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-[var(--card-2)] text-[var(--muted)]" aria-label="Back">
          <Icon name="back" size={18} />
        </button>
        <div className="flex bg-[var(--card-2)] rounded-xl p-1 gap-1">
          {(['photo', 'video', 'moment'] as const).map((t) => (
            <button
              key={t}
              onClick={() => (t === type ? onBack() : onSwitch(t))}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                type === t ? 'bg-[var(--card)] text-[var(--brand)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
              title={t === type ? 'Back to type selection' : `Switch to ${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Media picker */}
      {type !== 'moment' && (
        <div>
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
          {!preview ? (
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0]);
              }}
              className="w-full border-2 border-dashed border-[var(--border)] hover:border-[var(--brand)] rounded-2xl py-12 flex flex-col items-center gap-3 text-[var(--muted)] transition-colors"
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
                <Icon name={type === 'video' ? 'video' : 'image'} size={26} />
              </div>
              <p className="font-semibold text-[var(--text)]">Click or drag & drop your {type}</p>
              <p className="text-xs">{type === 'video' ? 'MP4, MOV or WebM · up to 300 MB' : 'JPG, PNG, GIF or WebP · up to 10 MB'}</p>
            </button>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] group">
              {type === 'video' ? (
                <video src={preview} controls className="w-full max-h-[340px] bg-black" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="w-full max-h-[340px] object-contain bg-[var(--card-2)]" />
              )}
              <div className="absolute top-3 right-3 flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold hover:bg-black/80">
                  Replace
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove media"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
              {file && (
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs">
                  {formatBytes(file.size)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={type === 'moment' ? 6 : 3}
        placeholder={
          type === 'moment'
            ? 'Write what’s really on your mind… this is a safe space. 💚'
            : 'Add a caption (required)…'
        }
        className="w-full px-4 py-3 bg-[var(--card-2)] rounded-xl text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 resize-none placeholder:text-[var(--muted)]"
        maxLength={2000}
      />

      {/* Topics */}
      <div>
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Add topics · {topics.length}/4</p>
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

      {/* Recommendation preview — deterministic, computed as you type */}
      {classified.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span className="font-medium">Ruhiz will share this with people who care about:</span>
          {classified.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--brand-soft)] text-[var(--brand)] rounded-full font-medium">
              <span aria-hidden>{c.emoji}</span> {c.label}
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-xl px-4 py-2.5">{error}</p>}

      {/* Progress */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Spinner size={16} className="text-[var(--brand)]" />
            {progress < 70 ? 'Uploading to R2…' : 'Publishing your moment…'}
          </div>
          <div className="h-1.5 rounded-full bg-[var(--card-2)] overflow-hidden">
            <div className="h-full bg-[var(--brand)] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-[var(--muted)]">{text.length}/2000</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-[var(--card-2)]">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canPost || uploading}
            className="px-6 py-2.5 rounded-xl bg-[var(--brand)] text-white text-sm font-semibold hover:bg-[var(--brand-dark)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {uploading && <Spinner size={14} />}
            {uploading ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
