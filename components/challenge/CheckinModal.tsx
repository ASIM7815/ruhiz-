'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ChallengeView, Checkin } from '@/lib/duel/types';
import { useStore } from '@/lib/duel/store';
import { Icon } from '@/components/ui/Icons';
import { GhostButton, Modal, ModalHeader, PrimaryButton, Spinner } from '@/components/ui/Primitives';
import { uploadMedia, validateUpload } from '@/lib/upload';
import { formatBytes } from '@/lib/format';
import { R2Image, R2Video } from '@/components/ui/Media';

interface CheckinModalProps {
  view: ChallengeView;
  open: boolean;
  onClose: () => void;
  dayNumber?: number;
  initialCheckin?: Checkin | null;
}

export default function CheckinModal({
  view,
  open,
  onClose,
  dayNumber: propDay,
  initialCheckin,
}: CheckinModalProps) {
  const { checkin } = useStore();
  const part = view.participation;

  const defaultDay = propDay ?? (part?.completedDays ?? 0) + 1;
  const [selectedDay, setSelectedDay] = useState<number>(defaultDay);
  const [note, setNote] = useState(initialCheckin?.note ?? '');
  const [mediaUrl, setMediaUrl] = useState<string | null>(initialCheckin?.mediaUrl ?? null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(initialCheckin?.mediaType ?? null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const target = propDay ?? (part?.completedDays ?? 0) + 1;
      setSelectedDay(Math.min(target, view.durationDays));
      setNote(initialCheckin?.note ?? '');
      setMediaUrl(initialCheckin?.mediaUrl ?? null);
      setMediaType(initialCheckin?.mediaType ?? null);
      setLocalPreview(null);
      setFileName(null);
      setFileSize(null);
      setUploadError(null);
      setUploading(false);
      setUploadPct(0);
    }
  }, [open, propDay, initialCheckin, part?.completedDays, view.durationDays]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      setUploadError('Unsupported file type. Please upload a photo (JPG, PNG, WebP) or video (MP4, MOV, WebM).');
      return;
    }

    const kind = isVideo ? 'proof-video' : 'proof-image';
    const validationErr = validateUpload(file, kind);
    if (validationErr) {
      setUploadError(validationErr);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setMediaType(isVideo ? 'video' : 'image');

    // Create local object URL for instant preview
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    // Start upload
    setUploading(true);
    setUploadPct(0);

    try {
      const res = await uploadMedia(file, kind, (pct) => {
        setUploadPct(pct);
      });
      setMediaUrl(res.key);
    } catch (err: any) {
      console.error('[CheckinModal] Upload error:', err);
      setUploadError(err?.message ?? 'Upload failed. Please check your file and try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = () => {
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview);
    }
    setMediaUrl(null);
    setMediaType(null);
    setLocalPreview(null);
    setFileName(null);
    setFileSize(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async () => {
    if (uploading) return;
    setBusy(true);
    setUploadError(null);

    try {
      const ck = await checkin(view.id, note.trim(), mediaUrl, mediaType, selectedDay);
      if (ck) {
        onClose();
      }
    } catch (err: any) {
      setUploadError(err?.message ?? 'Failed to submit check-in proof.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="checkin-title" maxWidth="max-w-lg">
      <ModalHeader
        title={initialCheckin ? `Edit Day ${selectedDay} Proof` : `Day ${selectedDay} Check-in & Proof`}
        onClose={onClose}
        subtitle={view.title}
      />

      <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        {/* Day selection header */}
        <div className="flex items-center justify-between bg-[var(--card-2)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center display text-lg font-bold border border-[var(--brand)]/30">
              {selectedDay}
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">
                Day {selectedDay} of {view.durationDays}
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
                {view.dailyTask || 'Show proof of today’s progress.'}
              </p>
            </div>
          </div>

          {/* Quick day switcher if needed */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={selectedDay <= 1}
              onClick={() => setSelectedDay((d) => Math.max(1, d - 1))}
              className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:pointer-events-none"
              title="Previous day"
            >
              <Icon name="arrowLeft" size={14} />
            </button>
            <span className="text-xs font-semibold px-1 text-[var(--muted)]">D{selectedDay}</span>
            <button
              type="button"
              disabled={selectedDay >= view.durationDays}
              onClick={() => setSelectedDay((d) => Math.min(view.durationDays, d + 1))}
              className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:pointer-events-none"
              title="Next day"
            >
              <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </div>

        {/* Media upload proof area */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Daily Proof Photo or Video <span className="text-[var(--brand)] font-normal">(up to 300 MB)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/x-m4v"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!localPreview && !mediaUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border)] hover:border-[var(--brand)]/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-[var(--card-2)]/50 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Icon name="upload" size={22} />
              </div>
              <p className="text-sm font-semibold text-[var(--text)]">
                Upload proof for Day {selectedDay}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Upload a video (up to 300 MB) or photo proving you completed the task.
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--card-2)] border border-[var(--border)] text-[var(--muted)] font-medium">
                  MP4, MOV, WebM ≤ 300MB
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--card-2)] border border-[var(--border)] text-[var(--muted)] font-medium">
                  JPG, PNG, WebP ≤ 15MB
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-[var(--card-2)] border border-[var(--border)] rounded-2xl overflow-hidden p-3 space-y-3">
              {/* Preview container */}
              <div className="relative rounded-xl overflow-hidden bg-black max-h-64 flex items-center justify-center">
                {mediaType === 'video' ? (
                  localPreview ? (
                    <video
                      src={localPreview}
                      controls
                      playsInline
                      className="w-full max-h-64 object-contain"
                    />
                  ) : (
                    <R2Video mediaKey={mediaUrl} className="w-full max-h-64 object-contain" controls />
                  )
                ) : localPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={localPreview}
                    alt="Proof preview"
                    className="w-full max-h-64 object-contain"
                  />
                ) : (
                  <R2Image mediaKey={mediaUrl} alt="Proof image" className="w-full max-h-64 object-contain" />
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 text-white p-4">
                    <Spinner size={24} />
                    <p className="text-xs font-semibold">Uploading proof… {uploadPct}%</p>
                    <div className="w-48 h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-[var(--brand)] transition-all duration-200"
                        style={{ width: `${uploadPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* File details & actions */}
              <div className="flex items-center justify-between text-xs px-1">
                <div className="min-w-0 flex-1 mr-2">
                  <p className="font-semibold text-[var(--text)] truncate">
                    {fileName || (mediaType === 'video' ? 'Video proof' : 'Photo proof')}
                  </p>
                  {fileSize && (
                    <p className="text-[11px] text-[var(--muted)]">{formatBytes(fileSize)}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <GhostButton
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="!py-1 !px-2.5 !text-xs"
                  >
                    Change
                  </GhostButton>
                  <button
                    type="button"
                    onClick={removeMedia}
                    disabled={uploading}
                    className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
                    title="Remove media"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {uploadError && (
            <div className="p-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
              <Icon name="warning" size={14} className="flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Description / Note */}
        <div>
          <label
            htmlFor="checkin-note"
            className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5"
          >
            Proof Description / Note
          </label>
          <textarea
            id="checkin-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder="Describe what you accomplished today, obstacles overcome, or your workout/task details…"
            className="w-full bg-[var(--card-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/60 resize-none transition-shadow"
          />
          <div className="flex items-center justify-between mt-1 text-[11px] text-[var(--muted)]">
            <span>Explain today’s progress for your challenge record</span>
            <span>{note.length}/1000</span>
          </div>
        </div>

        {/* Streak indicator */}
        <div className="flex items-center gap-2 text-xs text-[var(--muted)] bg-[var(--card-2)]/60 p-3 rounded-xl border border-[var(--border)]">
          <Icon name="flame" size={15} className="text-[var(--brand)]" />
          <span>
            Checking in records your proof and builds your consistency performance score.
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <GhostButton onClick={onClose} disabled={busy || uploading} className="flex-1">
            Cancel
          </GhostButton>
          <PrimaryButton
            onClick={submit}
            disabled={busy || uploading}
            className="flex-1"
          >
            {busy ? <Spinner size={16} /> : <Icon name="check" size={16} strokeWidth={3} />}
            {busy ? 'Saving…' : uploading ? `Uploading ${uploadPct}%` : initialCheckin ? 'Update Proof' : 'Log Day Proof'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
