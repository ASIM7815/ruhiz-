'use client';

import { getMediaBlob } from './idb-storage';

/**
 * Media URL resolution for Cloudflare R2 and client-side persistent storage.
 *
 * References store either:
 *   - a public URL (https://…, /images/…, data:, blob:) → used as-is
 *   - an IndexedDB key ("proofs/local/…") → resolved from IndexedDB to object URL
 *   - an R2 object key ("posts/…", "covers/…", "proofs/…") → resolved
 *     through /api/media which mints a short-lived presigned GET URL.
 */

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const DEFAULT_TTL_MS = 55 * 60 * 1000; // server signs for 1h

/** True when the string is a local IndexedDB reference. */
export function isLocalIdbKey(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith('proofs/local/') || value.startsWith('idb:');
}

/** True when the string is a bare R2 object key rather than a usable URL. */
export function isR2Key(value?: string | null): value is string {
  if (!value) return false;
  if (/^(https?:|data:|blob:)/i.test(value)) return false;
  if (value.startsWith('/')) return false;
  if (isLocalIdbKey(value)) return false;
  // keys look like "posts/<uuid>/…", "avatars/<uuid>/…", "chats/<uuid>/…", "proofs/<uuid>/…"
  return /^(posts|avatars|chats|covers|proofs)\/[^\s]+$/.test(value);
}

/** Resolve any media reference (URL, local key, or R2 key) into a displayable URL. */
export async function resolveMediaUrl(ref?: string | null, opts?: { force?: boolean }): Promise<string | null> {
  if (!ref) return null;

  // Plain usable URLs (https://, /images/, data:, blob:)
  if (!isR2Key(ref) && !isLocalIdbKey(ref)) {
    return ref;
  }

  // Check cache
  if (!opts?.force) {
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) return cached.url;

    const existing = inflight.get(ref);
    if (existing) return existing;
  } else {
    cache.delete(ref);
    inflight.delete(ref);
  }

  // Resolve local IndexedDB storage
  if (isLocalIdbKey(ref)) {
    const task = (async () => {
      try {
        const blob = await getMediaBlob(ref);
        if (!blob) return ref; // fallback
        const objUrl = URL.createObjectURL(blob);
        cache.set(ref, { url: objUrl, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        return objUrl;
      } catch {
        return ref;
      }
    })();

    inflight.set(ref, task);
    try {
      return await task;
    } finally {
      inflight.delete(ref);
    }
  }

  // Resolve R2 via API
  const task = (async () => {
    const res = await fetch(`/api/media?key=${encodeURIComponent(ref)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`media signing failed (${res.status})`);
    const json = (await res.json()) as { url?: string; expiresIn?: number };
    if (!json.url) throw new Error('media signing returned no url');
    cache.set(ref, {
      url: json.url,
      expiresAt: Date.now() + (json.expiresIn ? json.expiresIn * 1000 : DEFAULT_TTL_MS),
    });
    return json.url;
  })();

  inflight.set(ref, task);
  try {
    return await task;
  } catch {
    return null; // caller renders fallback
  } finally {
    inflight.delete(ref);
  }
}

/** Synchronous best-effort: returns cached URL or null (for initial render). */
export function peekMediaUrl(ref?: string | null): string | null {
  if (!ref) return null;
  if (!isR2Key(ref) && !isLocalIdbKey(ref)) return ref;
  const cached = cache.get(ref);
  return cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS ? cached.url : null;
}

export function clearMediaCache() {
  cache.clear();
  inflight.clear();
}
