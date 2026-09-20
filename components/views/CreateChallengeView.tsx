'use client';

import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/duel/store';
import { useNav } from '@/components/app/nav';
import { Icon } from '@/components/ui/Icons';
import { Cover, GhostButton, PrimaryButton, Segmented, Spinner } from '@/components/ui/Primitives';
import { uploadMedia, validateUpload } from '@/lib/upload';
import type { Difficulty } from '@/lib/duel/types';

const DURATION_PRESETS = [7, 14, 21, 30, 45, 60, 90];

export default function CreateChallengeView({ editId }: { editId?: string }) {
  const store = useStore();
  const { navigate } = useNav();
  const editing = useMemo(() => (editId ? store.findById(editId) : undefined), [editId, store]);

  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? store.categories[0]?.id ?? '');
  const [durationDays, setDurationDays] = useState(editing?.durationDays ?? 30);
  const [customDuration, setCustomDuration] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(editing?.difficulty ?? 'medium');
  const [dailyTask, setDailyTask] = useState(editing?.dailyTask ?? '');
  const [tags, setTags] = useState((editing?.tags ?? []).join(', '));
  const [coverUrl, setCoverUrl] = useState<string | null>(editing?.coverUrl ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const category = store.categories.find((c) => c.id === categoryId);

  const pickCover = async (file: File | undefined) => {
    if (!file) return;
    const err = validateUpload(file, 'challenge-cover');
    if (err) {
      setErrors((e) => ({ ...e, cover: err }));
      return;
    }
    setErrors((e) => ({ ...e, cover: '' }));
    setUploading(true);
    setUploadPct(0);
    try {
      const res = await uploadMedia(file, 'challenge-cover', setUploadPct);
      setCoverUrl(res.key);
      setCoverPreview(URL.createObjectURL(file));
    } catch (e: any) {
      setErrors((err2) => ({ ...err2, cover: e?.message ?? 'Upload failed.' }));
    } finally {
      setUploading(false);
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (title.trim().length < 4) e.title = 'Give your challenge a name (at least 4 characters).';
    if (title.trim().length > 80) e.title = 'Keep the title under 80 characters.';
    if (description.trim().length < 20) e.description = 'Describe the challenge in at least 20 characters.';
    if (!categoryId) e.category = 'Pick a category.';
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) e.duration = 'Duration must be between 1 and 365 days.';
    if (dailyTask.trim().length < 10) e.dailyTask = 'Tell participants what a daily check-in looks like (10+ characters).';
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const tagList = tags
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean)
      .slice(0, 6);
    if (editing) {
      const ok = await store.updateChallenge(editing.id, {
        title: title.trim(), description: description.trim(), categoryId, durationDays,
        difficulty, dailyTask: dailyTask.trim(), coverUrl, tags: tagList,
      });
      setBusy(false);
      if (ok) navigate('challenge', editing.id);
      return;
    }
    const ch = await store.createChallenge({
      title: title.trim(), description: description.trim(), categoryId, durationDays,
      difficulty, dailyTask: dailyTask.trim(), coverUrl, tags: tagList,
    });
    setBusy(false);
    if (ch) navigate('challenge', ch.id);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 fade-in">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-[var(--text)]">{editing ? 'Edit challenge' : 'Create a challenge'}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {editing ? 'Update the rules of your duel.' : 'Define the duel: what it is, how long it runs, and what a daily win looks like.'}
        </p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 sm:p-7 space-y-6">
        {/* Cover */}
        <div>
          <FieldLabel label="Cover image" hint="Optional · JPG, PNG or WebP up to 8 MB" />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-56 h-32 rounded-2xl overflow-hidden border border-[var(--border)] flex-shrink-0">
              {coverPreview || coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview ?? coverUrl ?? ''} alt="Challenge cover preview" className="w-full h-full object-cover" />
              ) : (
                <Cover category={category} title={title} />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void pickCover(e.target.files?.[0])}
              />
              <div className="flex gap-2">
                <GhostButton onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" size={15} /> {uploading ? `Uploading ${uploadPct}%` : 'Upload cover'}
                </GhostButton>
                {(coverUrl || coverPreview) && (
                  <GhostButton onClick={() => { setCoverUrl(null); setCoverPreview(null); }}>
                    <Icon name="trash" size={15} /> Remove
                  </GhostButton>
                )}
              </div>
              {uploading && <div className="h-1.5 rounded-full bg-[var(--card-2)] overflow-hidden"><div className="h-full bg-[var(--brand)] transition-all" style={{ width: `${uploadPct}%` }} /></div>}
              {errors.cover && <p className="text-xs text-[var(--danger)]">{errors.cover}</p>}
              <p className="text-xs text-[var(--muted)]">Without a cover we generate a category-colored plate automatically.</p>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <FieldLabel label="Challenge title" hint="e.g. 30 Days Coding" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="30 Days Coding"
            className={inputCls(errors.title)}
          />
          {errors.title && <p className="text-xs text-[var(--danger)] mt-1">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <FieldLabel label="Description" hint="What is the challenge and who is it for?" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={600}
            placeholder="Write code every day for 30 days. One commit, one snippet, one bug fixed — it all counts."
            className={inputCls(errors.description) + ' resize-none'}
          />
          <div className="flex justify-between mt-1">
            {errors.description ? <p className="text-xs text-[var(--danger)]">{errors.description}</p> : <span />}
            <p className="text-[11px] text-[var(--muted)]">{description.length}/600</p>
          </div>
        </div>

        {/* Category */}
        <div>
          <FieldLabel label="Category" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {store.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                  categoryId === c.id ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text)]' : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--brand)]/40'
                }`}
              >
                <span>{c.emoji}</span> <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
          {errors.category && <p className="text-xs text-[var(--danger)] mt-1">{errors.category}</p>}
        </div>

        {/* Duration */}
        <div>
          <FieldLabel label="Duration" hint="1–365 days" />
          <div className="flex flex-wrap gap-2 mb-2">
            {DURATION_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => { setDurationDays(d); setCustomDuration(''); }}
                className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
                  durationDays === d && !customDuration ? 'bg-[var(--brand)] text-black' : 'bg-[var(--card-2)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {d}d
              </button>
            ))}
            <input
              value={customDuration}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                setCustomDuration(v);
                if (v) setDurationDays(Number(v));
              }}
              placeholder="Custom"
              inputMode="numeric"
              aria-label="Custom duration in days"
              className="w-24 px-3 py-2 rounded-xl bg-[var(--card-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60"
            />
          </div>
          {errors.duration && <p className="text-xs text-[var(--danger)]">{errors.duration}</p>}
        </div>

        {/* Difficulty */}
        <div>
          <FieldLabel label="Difficulty" />
          <Segmented
            options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
            value={difficulty}
            onChange={setDifficulty}
          />
        </div>

        {/* Daily task */}
        <div>
          <FieldLabel label="Daily task" hint="What counts as a check-in?" />
          <input
            value={dailyTask}
            onChange={(e) => setDailyTask(e.target.value)}
            maxLength={200}
            placeholder="Commit code or solve one problem, then log what you built."
            className={inputCls(errors.dailyTask)}
          />
          {errors.dailyTask && <p className="text-xs text-[var(--danger)] mt-1">{errors.dailyTask}</p>}
        </div>

        {/* Tags */}
        <div>
          <FieldLabel label="Tags" hint="Comma separated, up to 6" />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="programming, consistency, commits"
            className={inputCls()}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <PrimaryButton onClick={() => void submit()} disabled={busy || uploading} className="flex-1">
            {busy ? <Spinner size={16} /> : <Icon name="swords" size={16} />}
            {busy ? 'Publishing…' : editing ? 'Save changes' : 'Publish challenge'}
          </PrimaryButton>
          <GhostButton onClick={() => navigate(editing ? 'challenge' : 'home', editing?.id)} className="flex-1">
            Cancel
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{label}</span>
      {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
    </div>
  );
}

function inputCls(error?: string): string {
  return `w-full bg-[var(--card-2)] border rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 transition-shadow ${
    error ? 'border-[var(--danger)]' : 'border-[var(--border)]'
  }`;
}
