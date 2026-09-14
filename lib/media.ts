'use client';

/**
 * Media URL resolution for the private Cloudflare R2 pipeline.
 *
 * Posts store either:
 *   - a public URL  (https://…, /images/…, data:, blob:)  → used as-is
 *   - an R2 object key ("posts/<uid>/<yyyy-mm>/<uuid>.<ext>") → resolved
 *     through /api/media which mints a short-lived presigned GET URL.
 *
 * Keys are cached in-memory and refreshed before expiry. Secrets never reach
 * the browser — signing happens server-side with the R2 credentials.
 */

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

const SAFETY_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const DEFAULT_TTL_MS = 55 * 60 * 1000; // server signs for 1h

/** True when the string is a bare R2 object key rather than a usable URL. */
export function isR2Key(value?: string | null): value is string {
  if (!value) return false;
  if (/^(https?:|data:|blob:)/i.test(value)) return false;
  if (value.startsWith('/')) return false;
  // keys look like "posts/<uuid>/…", "avatars/<uuid>/…", "chats/<uuid>/…"
  return /^(posts|avatars|chats)\/[^\s]+$/.test(value);
}

/** Resolve any media reference (URL or R2 key) into a displayable URL. */
export async function resolveMediaUrl(ref?: string | null, opts?: { force?: boolean }): Promise<string | null> {
  if (!ref) return null;
  if (!isR2Key(ref)) return ref;

  if (!opts?.force) {
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) return cached.url;

    const existing = inflight.get(ref);
    if (existing) return existing;
  } else {
    // The caller hit a playback/load error with the URL we already handed out
    // (most often a presigned URL that outlived its hour, or a transient blip).
    // Drop it so the next sign is genuinely fresh.
    cache.delete(ref);
    inflight.delete(ref);
  }

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
  if (!isR2Key(ref)) return ref;
  const cached = cache.get(ref);
  return cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS ? cached.url : null;
}

export function clearMediaCache() {
  cache.clear();
  inflight.clear();
}
