'use client';

import { fileToDataURL } from './format';
export { fileToDataURL, blobToFile } from './format';
import { isR2Configured, isSupabaseConfigured } from './config';

/**
 * Production media upload pipeline.
 *
 * Flow (never exposes R2 credentials to the browser):
 *   1. POST /api/upload/presign  → server validates the request (auth,
 *      mime allow-list, size caps) and mints a presigned PUT URL for a
 *      unique, user-scoped object key.
 *   2. PUT the file straight to Cloudflare R2 with XHR so we get real
 *      upload progress, with automatic retry + exponential backoff.
 *   3. POST /api/upload/complete → server verifies the object exists.
 *
 * In demo mode (no R2 configured) it falls back to a data URL / object URL
 * so the app keeps working end-to-end.
 */

export type UploadKind = 'post-image' | 'post-video' | 'avatar' | 'cover' | 'chat-image';

export interface UploadResult {
  /** R2 object key (production) or data/object URL (demo fallback). */
  key: string;
  storage: 'r2' | 'local';
}

export const UPLOAD_LIMITS: Record<UploadKind, { maxMB: number; mimes: string[] }> = {
  'post-image': { maxMB: 10, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  'chat-image': { maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  avatar: { maxMB: 5, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  cover: { maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  'post-video': { maxMB: 300, mimes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'] },
};

export function validateUpload(file: File, kind: UploadKind): string | null {
  const limit = UPLOAD_LIMITS[kind];
  if (!limit.mimes.includes(file.type)) {
    return kind === 'post-video'
      ? 'Unsupported video format. Use MP4, MOV or WebM.'
      : 'Unsupported image format. Use JPG, PNG, GIF or WebP.';
  }
  if (file.size > limit.maxMB * 1024 * 1024) {
    return `File too large — maximum ${limit.maxMB} MB.`;
  }
  if (file.size === 0) return 'That file looks empty.';
  return null;
}

/**
 * The server has no media storage configured at all (demo deployment). Only
 * this case may fall back to session-local media — a configured backend that
 * simply failed must not, because the fallback URL would be persisted.
 */
class StorageNotConfiguredError extends Error {}

interface PresignResponse {
  key: string;
  uploadUrl: string;
  expiresIn: number;
}

async function presign(file: File, kind: UploadKind): Promise<PresignResponse> {
  const res = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, filename: file.name, contentType: file.type, size: file.size }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 503) throw new StorageNotConfiguredError(json.error || 'Media storage is not configured.');
  if (!res.ok) throw new Error(json.error || `Could not start upload (${res.status})`);
  return json as PresignResponse;
}

/** XHR PUT with real progress + retries with exponential backoff. */
function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
  retries = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        if (xhr.status >= 500 && remaining > 0) {
          window.setTimeout(() => attempt(remaining - 1), 800 * Math.pow(2, retries - remaining));
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => {
        if (remaining > 0) {
          window.setTimeout(() => attempt(remaining - 1), 800 * Math.pow(2, retries - remaining));
        } else {
          reject(new Error('Network error during upload — check your connection and try again.'));
        }
      };
      xhr.ontimeout = () => {
        if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 800);
        else reject(new Error('Upload timed out. Try a smaller file or faster connection.'));
      };
      xhr.send(file);
    };
    attempt(retries);
  });
}

async function verifyComplete(key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json.exists);
  } catch {
    return false;
  }
}

/**
 * Upload media. Resolves with an object key (production R2) or a local URL
 * (demo fallback). `onProgress` receives 0–100.
 */
export async function uploadMedia(
  file: File,
  kind: UploadKind,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const validationError = validateUpload(file, kind);
  if (validationError) throw new Error(validationError);

  onProgress?.(4);

  if (isR2Configured) {
    try {
      const { key, uploadUrl } = await presign(file, kind);
      onProgress?.(8);
      await putWithProgress(uploadUrl, file, file.type, (pct) => onProgress?.(8 + Math.round(pct * 0.82)));
      onProgress?.(94);
      const ok = await verifyComplete(key);
      if (!ok) console.warn('[upload] object verification skipped/failed — continuing');
      onProgress?.(100);
      return { key, storage: 'r2' };
    } catch (err) {
      if (!(err instanceof StorageNotConfiguredError)) {
        // Storage IS configured but this upload did not land. Falling back here
        // used to hand the composer a blob: URL, which was written to
        // posts.video_url and reported as a success — then died with the page
        // and rendered "Video unavailable" forever, for everyone. Fail loudly
        // (but kindly) so nothing unplayable is ever persisted.
        console.error('[upload] media upload failed:', err);
        throw new Error(
          file.type.startsWith('video/')
            ? 'Your video could not be uploaded. Please check your connection and try again.'
            : 'Your photo could not be uploaded. Please check your connection and try again.'
        );
      }
      console.warn('[upload] media storage not configured — using session-local fallback');
      // fall through to local fallback so the app keeps working in demo mode
    }
  }

  // Demo fallback. A data: URL is self-contained and safe to persist; a blob:
  // URL is tied to this page session, so it must never reach the database.
  if (file.type.startsWith('image/') && file.size <= 3.5 * 1024 * 1024) {
    const dataUrl = await fileToDataURL(file);
    onProgress?.(100);
    return { key: dataUrl, storage: 'local' };
  }

  if (isSupabaseConfigured) {
    // Real database in play: refuse rather than store a reference that cannot
    // survive a reload.
    throw new Error(
      file.type.startsWith('video/')
        ? 'Video hosting is not set up yet, so videos cannot be shared. Please try a photo instead.'
        : 'That file is too large to share without media hosting set up.'
    );
  }

  const objUrl = URL.createObjectURL(file);
  onProgress?.(100);
  return { key: objUrl, storage: 'local' };
}

/** Back-compat helper used by older call-sites (image-only uploads). */
export async function uploadImage(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const res = await uploadMedia(file, 'post-image', onProgress);
  return res.key;
}

