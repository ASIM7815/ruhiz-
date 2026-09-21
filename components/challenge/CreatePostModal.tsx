'use client';

import { useState, useRef } from 'react';
import { Icon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Primitives';
import { uploadMedia, type UploadedMedia } from '@/lib/upload';

interface CreatePostModalProps {
  challengeId: string;
  challengeTitle: string;
  dayNumber: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  file: File;
  preview: string;
  uploaded?: UploadedMedia;
  uploading?: boolean;
  error?: string;
}

export default function CreatePostModal({
  challengeId,
  challengeTitle,
  dayNumber,
  onClose,
  onSuccess,
}: CreatePostModalProps) {
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newMedia: MediaItem[] = files
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .slice(0, 10 - media.length) // Max 10 items
      .map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        file,
        preview: URL.createObjectURL(file),
      }));

    setMedia((prev) => [...prev, ...newMedia]);
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((m) => m.id !== id);
    });
  };

  const publish = async () => {
    if (!caption.trim() && media.length === 0) {
      setError('Add a caption or upload photos/videos');
      return;
    }

    setPublishing(true);
    setError('');

    try {
      // Upload all media files first
      const uploadedMedia: UploadedMedia[] = [];
      for (const item of media) {
        setMedia((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, uploading: true } : m))
        );

        try {
          const uploaded = await uploadMedia(item.file);
          uploadedMedia.push(uploaded);
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id ? { ...m, uploaded, uploading: false } : m
            )
          );
        } catch (err: any) {
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, uploading: false, error: err.message }
                : m
            )
          );
          throw new Error(`Upload failed: ${err.message}`);
        }
      }

      // Create the post via API
      const res = await fetch('/api/challenge-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          dayNumber,
          caption: caption.trim(),
          media: uploadedMedia.map((m, i) => ({
            type: m.type,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            width: m.width,
            height: m.height,
            durationMs: m.durationMs,
            fileSize: m.fileSize,
            sortOrder: i,
          })),
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        console.error('Post creation failed:', data);
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      console.log('Post created successfully:', data);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--card)] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-bold">Day {dayNumber} Entry</h2>
            <p className="text-sm text-[var(--muted)]">{challengeTitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={publishing}
            className="p-2 hover:bg-[var(--hover)] rounded-lg transition-colors"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Caption */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Caption / Description
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="How did Day 1 go? What did you accomplish?"
              className="w-full px-4 py-3 bg-[var(--input)] border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              rows={4}
              maxLength={2000}
              disabled={publishing}
            />
            <div className="text-xs text-[var(--muted)] mt-1 text-right">
              {caption.length}/2000
            </div>
          </div>

          {/* Media Grid */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square bg-[var(--hover)] rounded-xl overflow-hidden"
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.preview}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {item.uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Spinner size={24} />
                    </div>
                  )}

                  {item.error && (
                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center p-2">
                      <p className="text-xs text-red-300 text-center">
                        {item.error}
                      </p>
                    </div>
                  )}

                  {!item.uploading && !item.error && (
                    <button
                      onClick={() => removeMedia(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                      disabled={publishing}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}

                  {item.type === 'video' && !item.uploading && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded-full text-xs">
                      <Icon name="video" size={12} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Media Button */}
          {media.length < 10 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={publishing}
              className="w-full py-3 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--brand)] hover:bg-[var(--hover)] transition-colors flex items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--text)]"
            >
              <Icon name="image" size={20} />
              <span className="font-medium">
                Add Photos/Videos ({media.length}/10)
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-5 py-2.5 rounded-xl font-semibold hover:bg-[var(--hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={publish}
            disabled={publishing || (!caption.trim() && media.length === 0)}
            className="px-5 py-2.5 bg-[var(--brand)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {publishing && <Spinner size={16} />}
            {publishing ? 'Publishing...' : 'Publish Day ' + dayNumber}
          </button>
        </div>
      </div>
    </div>
  );
}
