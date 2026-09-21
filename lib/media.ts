/**
 * Media URL resolver.
 *
 * Media references stored on rows can be:
 *   - R2 object keys     `posts/{uid}/2026-09/abc.jpg`      → signed GET /api/media?key=…
 *   - Supabase Storage   `supa://{bucket}/{kind}/{uid}/…`   → public URL (duel-media)
 *                        or a short-lived signed URL (duel-chat, private)
 *   - Local device blobs `idb://media:…`                    → object URL from IndexedDB
 *   - plain https URLs, `/…` paths, data: and blob: URLs    → used as-is
 *
 * For Supabase Storage, resolution is only needed for the private chat bucket:
 * duel-media is a public bucket (standard CDN-cached user-generated content),
 * duel-chat is private and protected by storage RLS (conversation members).
 */

import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/config';
import { peekLocalMedia } from '@/lib/upload';

const objectUrlCache = new Map<string, string>();
const pendingLookups = new Map<string, Promise<string>>();

/** R2 keys: {kind}/{userId}/{yyyy-mm}/{id}.{ext} */
export function isR2Key(path?: string | null): path is string {
  return Boolean(path) && /^(posts|avatars|chats|covers|proofs)\/[A-Za-z0-9_-]+\//.test(path as string);
}

export function isSupaRef(ref?: string | null): ref is string {
  return Boolean(ref) && (ref as string).startsWith('supa://');
}

export function isIdbRef(ref?: string | null): ref is string {
  return Boolean(ref) && (ref as string).startsWith('idb://');
}

export function needsResolve(ref?: string | null): boolean {
  return isR2Key(ref) || isSupaRef(ref) || isIdbRef(ref);
}

export function r2Src(key: string): string {
  return `/api/media?key=${encodeURIComponent(key)}`;
}

export function supaPublicSrc(ref: string): string {
  // supa://bucket/kind/uid/… → client SDK public URL for the object path
  const withoutScheme = ref.slice('supa://'.length);
  const slash = withoutScheme.indexOf('/');
  const bucket = withoutScheme.slice(0, slash);
  const path = withoutScheme.slice(slash + 1);
  if (!isSupabaseConfigured) return ref;
  const supa = createClient();
  return supa.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Synchronously map a stored media reference to something an <img>/<video>
 * can load without waiting. For private stores this is a permissive URL —
 * call resolveMediaUrl() for the real, signed one.
 */
export function peekMediaUrl(path?: string | null): string {
  if (!path) return '';
  if (isSupaRef(path)) {
    const bucket = path.slice('supa://'.length).split('/')[0];
    if (bucket === 'duel-chat') {
      // private — the signed URL is fetched asynchronously
      return objectUrlCache.get(path) ?? '';
    }
    return supaPublicSrc(path);
  }
  if (isIdbRef(path)) {
    return objectUrlCache.get(path) ?? '';
  }
  if (isR2Key(path)) {
    if (typeof window !== 'undefined') {
      const cached = objectUrlCache.get(path);
      if (cached) return cached;
      // kick off the fetch; components re-render via resolveMediaUrl().then
      void resolveMediaUrl(path);
    }
    return r2Src(path);
  }
  return path;
}

export async function resolveMediaUrl(
  path?: string | null,
  opts?: { force?: boolean }
): Promise<string> {
  if (!path) return '';
  if (!isR2Key(path) && !isSupaRef(path) && !isIdbRef(path)) return path;

  if (opts?.force) {
    releaseMediaUrl(path);
  }
  const cached = objectUrlCache.get(path);
  if (cached) return cached;

  // Coalesce concurrent requests for the same key.
  const inflight = pendingLookups.get(path);
  if (inflight) return inflight;

  const lookup = (async (): Promise<string> => {
    try {
      let url = '';

      if (isSupaRef(path)) {
        const withoutScheme = path.slice('supa://'.length);
        const slash = withoutScheme.indexOf('/');
        const bucket = withoutScheme.slice(0, slash);
        const objectPath = withoutScheme.slice(slash + 1);
        if (bucket === 'duel-chat' && isSupabaseConfigured) {
          const supa = createClient();
          const { data, error } = await supa.storage
            .from(bucket)
            .createSignedUrl(objectPath, 3600);
          url = error ? '' : data?.signedUrl ?? '';
        } else {
          url = supaPublicSrc(path);
        }
      } else if (isIdbRef(path)) {
        url = (await peekLocalMedia(path)) ?? '';
      } else {
        const res = await fetch(`/api/media?key=${encodeURIComponent(path)}`);
        if (!res.ok) {
          console.error(`[media] resolve failed ${res.status} for key`, String(path).slice(0, 64));
          return path;
        }
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
      }

      if (url) {
        objectUrlCache.set(path, url);
        return url;
      }
      return isSupaRef(path) || isIdbRef(path) ? '' : path;
    } catch (err) {
      console.error('[media] resolve error for', path.slice(0, 64), err);
      return isR2Key(path) ? path : '';
    } finally {
      pendingLookups.delete(path);
    }
  })();

  pendingLookups.set(path, lookup);
  return lookup;
}

/** Drop cached object URLs (e.g. after deleting media). */
export function releaseMediaUrl(ref?: string | null): void {
  if (!ref) return;
  const cached = objectUrlCache.get(ref);
  if (cached && cached.startsWith('blob:')) URL.revokeObjectURL(cached);
  objectUrlCache.delete(ref);
}
