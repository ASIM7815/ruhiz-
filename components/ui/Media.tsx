'use client';

import React, { useEffect, useState } from 'react';
import { isR2Key, peekMediaUrl, resolveMediaUrl } from '@/lib/media';

/**
 * Media components that transparently display either plain URLs (static
 * assets, external videos) or private Cloudflare R2 object keys — resolving
 * keys to short-lived presigned GET URLs via /api/media.
 */

export function R2Image({
  mediaKey,
  alt,
  className,
  loading = 'lazy',
  onClick,
}: {
  mediaKey?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(() => peekMediaUrl(mediaKey));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (!mediaKey) {
      setUrl(null);
      return;
    }
    if (!isR2Key(mediaKey)) {
      setUrl(mediaKey);
      return;
    }
    setUrl(peekMediaUrl(mediaKey));
    resolveMediaUrl(mediaKey)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [mediaKey]);

  if (!mediaKey || failed || !url) {
    return (
      <div className={`w-full bg-[var(--card-2)] flex items-center justify-center text-[var(--muted)] ${className ?? ''}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  );
}

export function R2Video({
  mediaKey,
  className,
  controls = true,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
}: {
  mediaKey?: string | null;
  className?: string;
  controls?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (t: number) => void;
}) {
  const [url, setUrl] = useState<string | null>(() => peekMediaUrl(mediaKey));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (!mediaKey) {
      setUrl(null);
      return;
    }
    if (!isR2Key(mediaKey)) {
      setUrl(mediaKey);
      return;
    }
    setUrl(peekMediaUrl(mediaKey));
    resolveMediaUrl(mediaKey)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [mediaKey]);

  if (!mediaKey || failed || !url) {
    return (
      <div className={`w-full bg-black/80 flex items-center justify-center text-white/70 ${className ?? ''}`} style={{ minHeight: 220 }}>
        <p className="text-sm">Video unavailable</p>
      </div>
    );
  }

  return (
    <video
      key={url} // remount when the presigned URL rotates
      src={url}
      className={className}
      controls={controls}
      playsInline
      preload="metadata"
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      onError={() => setFailed(true)}
    />
  );
}

/** React hook: resolves any media ref (URL or R2 key) to a displayable URL. */
export function useMediaUrl(ref?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => peekMediaUrl(ref));
  useEffect(() => {
    let alive = true;
    if (!ref) {
      setUrl(null);
      return;
    }
    if (!isR2Key(ref)) {
      setUrl(ref);
      return;
    }
    setUrl(peekMediaUrl(ref));
    resolveMediaUrl(ref)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [ref]);
  return url;
}
