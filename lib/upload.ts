/**
 * Media upload pipeline with three interchangeable storage backends:
 *
 *   1. Cloudflare R2 (when configured)  — presigned PUT via /api/upload/*
 *      keys: {kind}/{userId}/{yyyy-mm}/{id}.{ext}   (signed fetch via /api/media)
 *   2. Supabase Storage (always available with Supabase) — direct client upload
 *      with per-user folder RLS ({kind}/{uid}/... enforces ownership server-side)
 *      keys: supa://{bucket}/{kind}/{userId}/{yyyy-mm}/{id}.{ext}
 *   3. IndexedDB (no backend configured) — offline/demo persistence
 *      keys: idb://media:{kind}/{userId}/…
 *
 * One key convention across stores: {kind}/{userId}/... so delete authorization
 * ("only your own files") is the same everywhere. Videos up to 300 MB.
 */

import { isR2Configured, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { saveMediaBlob, deleteMediaBlob, getMediaBlob } from '@/lib/idb-storage';

export type MediaKind = 'posts' | 'avatars' | 'covers' | 'chats' | 'proofs';
export type MediaStore = 'r2' | 'supabase' | 'local';

/** Per-purpose kinds understood by /api/upload/presign (kept for callers). */
export type UploadKind =
  | 'post-image'
  | 'post-video'
  | 'chat-image'
  | 'avatar'
  | 'cover'
  | 'challenge-cover'
  | 'proof-image'
  | 'proof-video';

export interface UploadResult {
  /** storage URL/key stored in the DB (R2 key, supa:// URI, or idb:// URI) */
  url: string;
  key: string;
  kind: MediaKind;
  mediaType: 'image' | 'video';
  size: number;
}

export interface UploadOptions {
  kind?: MediaKind | UploadKind;
  /** 0..100 */
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

const MAX_BYTES = 300 * 1024 * 1024; // 300 MB — matches duel-media bucket limit
const MAX_CHAT_BYTES = 12 * 1024 * 1024; // 12 MB — matches duel-chat bucket limit

interface KindCfg {
  folder: MediaKind;
  maxMB: number;
  mimes: string[];
}

const KIND_RULES: Record<UploadKind, KindCfg> = {
  'post-image': { folder: 'posts', maxMB: 15, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  'post-video': { folder: 'posts', maxMB: 300, mimes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'] },
  'chat-image': { folder: 'chats', maxMB: 12, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  avatar: { folder: 'avatars', maxMB: 5, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  cover: { folder: 'covers', maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  'challenge-cover': { folder: 'covers', maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  'proof-image': { folder: 'proofs', maxMB: 15, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  'proof-video': { folder: 'proofs', maxMB: 300, mimes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/ogg'] },
};

function rulesFor(kind?: MediaKind | UploadKind): KindCfg {
  if (kind && kind in KIND_RULES) return KIND_RULES[kind as UploadKind];
  const folder = (kind as MediaKind) ?? 'posts';
  if (folder === 'chats') return KIND_RULES['chat-image'];
  if (folder === 'avatars') return KIND_RULES.avatar;
  if (folder === 'covers') return KIND_RULES['challenge-cover'];
  return { folder, maxMB: 300, mimes: [] };
}

/** Map a per-purpose kind to its storage folder. */
export function folderOf(kind?: MediaKind | UploadKind): MediaKind {
  return rulesFor(kind).folder;
}

/**
 * Client-side preflight (the server + bucket rules remain the authority).
 * Returns an error message, or null when the file looks acceptable.
 */
export function validateUpload(file: File, kind?: MediaKind | UploadKind): string | null {
  const cfg = rulesFor(kind);
  const type = (file.type || '').toLowerCase();
  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  if (!isImage && !isVideo) return 'Only image or video files are supported.';
  if (cfg.mimes.length && !cfg.mimes.includes(type)) return 'Unsupported file type.';
  const cap = Math.min(cfg.maxMB, cfg.folder === 'chats' ? 12 : 300) * 1024 * 1024;
  if (file.size > cap) {
    const mb = Math.round(cap / 1024 / 1024);
    return `File is too large — the limit is ${mb} MB.`;
  }
  return null;
}

function extOf(file: File): string {
  const fromName = /\.([a-zA-Z0-9]{1,5})$/.exec(file.name || '');
  if (fromName) return fromName[1].toLowerCase();
  const subtype = file.type.split('/')[1] ?? 'bin';
  return subtype.replace('jpeg', 'jpg').slice(0, 5);
}

function nanoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function mediaKey(userId: string, kind: MediaKind, file: File): string {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  // Same key convention for R2 + Supabase: {kind}/{userId}/{yyyy-mm}/{id}.{ext}
  // so "only your own files" is checkable from the key alone on every backend.
  return `${kind}/${userId}/${ym}/${nanoId()}.${extOf(file)}`;
}

/** Which backend to use. Explicit override wins; else R2 → Supabase → local. */
export function chooseMediaStore(): MediaStore {
  const override = (process.env.NEXT_PUBLIC_MEDIA_STORE ?? '').trim().toLowerCase();
  if (override === 'r2' || override === 'supabase' || override === 'local') return override;
  if (isR2Configured) return 'r2';
  if (isSupabaseConfigured) return 'supabase';
  return 'local';
}

/**
 * Upload a file to whichever storage backend is active.
 * Accepts either the structured options object or the legacy
 * (file, kind, onProgress) call shape.
 */
export async function uploadMedia(
  file: File,
  optsOrKind?: UploadOptions | MediaKind | UploadKind,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  let opts: UploadOptions;
  if (typeof optsOrKind === 'string') opts = { kind: optsOrKind, onProgress };
  else opts = optsOrKind ?? {};

  const err = validateUpload(file, opts.kind);
  if (err) throw new Error(err);
  const kind = folderOf(opts.kind);
  const store = chooseMediaStore();

  if (store === 'r2') return uploadToR2(file, kind, opts);
  if (store === 'supabase') return uploadToSupabase(file, kind, opts);
  return uploadToLocal(file, kind, opts);
}

/** Convenience for chat image uploads. */
export async function uploadChatImage(file: File, conversationId?: string): Promise<UploadResult> {
  void conversationId;
  return uploadMedia(file, { kind: 'chats' });
}

/* ------------------------------- R2 backend ------------------------------ */

async function uploadToR2(file: File, kind: MediaKind, opts: UploadOptions): Promise<UploadResult> {
  const presignKind: UploadKind =
    kind === 'chats'
      ? 'chat-image'
      : kind === 'avatars'
        ? 'avatar'
        : kind === 'covers'
          ? 'challenge-cover'
          : kind === 'proofs'
            ? file.type.startsWith('video/')
              ? 'proof-video'
              : 'proof-image'
            : file.type.startsWith('video/')
              ? 'post-video'
              : 'post-image';

  const presignRes = await fetch('/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      kind: presignKind,
    }),
    signal: opts.signal,
  });

  if (!presignRes.ok) {
    const body = await presignRes.text();
    let msg = 'Could not start the upload.';
    try {
      msg = JSON.parse(body).error ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }

  const { uploadUrl, key: finalKey, contentType, expiresIn } = await presignRes.json();

  await xhrPut(uploadUrl, file, {
    // must match the value the presign route signed exactly (lowercased)
    contentType: contentType ?? file.type,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });

  const completeRes = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: finalKey, contentType: contentType ?? file.type }),
    signal: opts.signal,
  });
  if (!completeRes.ok) {
    const body = await completeRes.text();
    let msg = 'The upload finished but could not be recorded.';
    try {
      msg = JSON.parse(body).error ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }

  void expiresIn;
  return {
    url: finalKey,
    key: finalKey,
    kind,
    mediaType: file.type.startsWith('video/') ? 'video' : 'image',
    size: file.size,
  };
}

async function xhrPut(
  url: string,
  file: File,
  opts: { contentType: string; onProgress?: (pct: number) => void; signal?: AbortSignal }
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', opts.contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/* --------------------------- Supabase backend ---------------------------- */

async function uploadToSupabase(file: File, kind: MediaKind, opts: UploadOptions): Promise<UploadResult> {
  const uid = await currentUserId();
  const key = mediaKey(uid, kind, file);
  const bucket = kind === 'chats' ? 'duel-chat' : 'duel-media';

  const supa = createClient();
  const { data: sessionData } = await supa.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  // XHR so large videos report upload progress; the storage REST API enforces
  // the same owner-folder RLS as the SDK (foldername[2] = auth.uid()).
  const endpoint = `${supabaseUrl()}/storage/v1/object/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken ?? supabaseAnonKey()}`);
    xhr.setRequestHeader('apikey', supabaseAnonKey());
    xhr.setRequestHeader('x-upsert', 'false');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100);
        resolve();
      } else {
        let msg = `Upload failed (HTTP ${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.message || body.error || msg;
        } catch {
          /* keep default */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });

  return {
    url: `supa://${bucket}/${key}`,
    key,
    kind,
    mediaType: file.type.startsWith('video/') ? 'video' : 'image',
    size: file.size,
  };
}

/* ----------------------------- local backend ----------------------------- */

async function uploadToLocal(file: File, kind: MediaKind, opts: UploadOptions): Promise<UploadResult> {
  const key = mediaKey(await currentUserId(), kind, file);
  opts.onProgress?.(30);
  const idbKey = `media:${key}`;
  await saveMediaBlob(idbKey, file, file.name || `${kind}.${extOf(file)}`);
  opts.onProgress?.(100);
  return {
    url: `idb://${idbKey}`,
    key: idbKey,
    kind,
    mediaType: file.type.startsWith('video/') ? 'video' : 'image',
    size: file.size,
  };
}

/* --------------------------- shared helpers ------------------------------ */

async function currentUserId(): Promise<string> {
  if (!isSupabaseConfigured) return 'local';
  const supa = createClient();
  const { data } = await supa.auth.getUser();
  return data?.user?.id ?? 'anon';
}

export function isSupaRef(ref: string): boolean {
  return ref.startsWith('supa://');
}

export function isIdbRef(ref: string): boolean {
  return ref.startsWith('idb://');
}

/**
 * Delete a media object the caller owns. Storage RLS (Supabase), the session +
 * key-prefix check (R2 /api/upload/delete), or the local device store (IndexedDB)
 * enforces "only your own files" — never the UI.
 */
export async function deleteMedia(ref: string): Promise<void> {
  if (!ref) return;

  if (isSupaRef(ref)) {
    const withoutScheme = ref.slice('supa://'.length);
    const slash = withoutScheme.indexOf('/');
    const bucket = withoutScheme.slice(0, slash);
    const path = withoutScheme.slice(slash + 1);
    const supa = createClient();
    const { error } = await supa.storage.from(bucket).remove([path]);
    // Storage RLS denies foreign files silently (0 rows) or with an error —
    // either way nothing else is deleted.
    if (error && !/not found/i.test(error.message ?? '')) throw error;
    return;
  }

  if (isIdbRef(ref)) {
    await deleteMediaBlob(ref.slice('idb://'.length));
    return;
  }

  // R2 object key (kind/user path) → authenticated server delete
  const res = await fetch('/api/upload/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: ref }),
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = 'Could not delete the file.';
    try {
      msg = JSON.parse(body).error ?? msg;
    } catch {
      /* keep default */
    }
    if (!/not found/i.test(msg)) throw new Error(msg);
  }
}

/** Re-fetch a local blob as an object URL (used by the media resolver). */
export async function peekLocalMedia(ref: string): Promise<string | null> {
  if (!isIdbRef(ref)) return null;
  const blob = await getMediaBlob(ref.slice('idb://'.length));
  return blob ? URL.createObjectURL(blob) : null;
}
