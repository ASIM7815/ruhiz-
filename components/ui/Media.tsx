'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { isR2Key, peekMediaUrl, resolveMediaUrl } from '@/lib/media';

/**
 * Media components that transparently display either plain URLs (static
 * assets, external videos) or private Cloudflare R2 object keys — resolving
 * keys to short-lived presigned GET URLs via /api/media.
 *
 * A signed URL is only valid for an hour, so every component distinguishes
 * "still resolving" from "genuinely broken" and gets one automatic retry with a
 * freshly signed URL before it admits defeat. Nothing about the underlying
 * failure is ever surfaced to the member.
 */

type MediaState = 'empty' | 'loading' | 'ready' | 'failed';

function Spinner({ label }: { label?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--muted)]">
      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="text-xs">{label}</span> : null}
    </div>
  );
}

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
  const [state, setState] = useState<MediaState>(() =>
    !mediaKey ? 'empty' : !isR2Key(mediaKey) || peekMediaUrl(mediaKey) ? 'ready' : 'loading'
  );
  const retried = useRef(false);

  const load = useCallback(
    (force: boolean) => {
      if (!mediaKey) {
        setUrl(null);
        setState('empty');
        return;
      }
      if (!isR2Key(mediaKey)) {
        setUrl(mediaKey);
        setState('ready');
        return;
      }
      setState('loading');
      resolveMediaUrl(mediaKey, { force })
        .then((u) => {
          if (u) {
            setUrl(u);
            setState('ready');
          } else {
            setState('failed');
          }
        })
        .catch(() => setState('failed'));
    },
    [mediaKey]
  );

  useEffect(() => {
    retried.current = false;
    load(false);
  }, [load]);

  /** One silent retry with a new signed URL before showing the fallback. */
  const handleError = () => {
    if (isR2Key(mediaKey) && !retried.current) {
      retried.current = true;
      setUrl(null);
      load(true);
      return;
    }
    setState('failed');
  };

  if (state === 'empty' || state === 'failed' || !url) {
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

  if (state === 'loading') {
    return (
      <div className={`w-full bg-[var(--card-2)] flex items-center justify-center ${className ?? ''}`}>
        <Spinner />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={url}
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      onClick={onClick}
      onError={handleError}
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
  poster,
  muted = false,
}: {
  mediaKey?: string | null;
  className?: string;
  controls?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (t: number) => void;
  poster?: string | null;
  /** Muted preview, e.g. the profile video grid tiles. */
  muted?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(() => peekMediaUrl(mediaKey));
  const [state, setState] = useState<MediaState>(() =>
    !mediaKey ? 'empty' : !isR2Key(mediaKey) || peekMediaUrl(mediaKey) ? 'ready' : 'loading'
  );
  const retried = useRef(false);

  const load = useCallback(
    (force: boolean) => {
      if (!mediaKey) {
        setUrl(null);
        setState('empty');
        return;
      }
      if (!isR2Key(mediaKey)) {
        setUrl(mediaKey);
        setState('ready');
        return;
      }
      setState('loading');
      resolveMediaUrl(mediaKey, { force })
        .then((u) => {
          if (u) {
            setUrl(u);
            setState('ready');
          } else {
            setState('failed');
          }
        })
        .catch(() => setState('failed'));
    },
    [mediaKey]
  );

  useEffect(() => {
    retried.current = false;
    load(false);
  }, [load]);

  const handleError = () => {
    // A signed URL can expire while the member is still on the page, and a
    // transient network blip looks identical to a broken file from the element's
    // point of view. Re-sign once before giving up.
    if (isR2Key(mediaKey) && !retried.current) {
      retried.current = true;
      setUrl(null);
      load(true);
      return;
    }
    setState('failed');
  };

  const retry = () => {
    retried.current = false;
    load(true);
  };

  // YouTube/Vimeo style embeds are only ever plain URLs stored on the post —
  // an R2 key always resolves to our own signed object URL. Checking the
  // original reference (not the signed URL) keeps the 11-character video-id
  // pattern from ever being matched against a signed URL by accident.
  const embedId = !isR2Key(mediaKey ?? '') ? getYouTubeVideoId(mediaKey ?? '') : null;

  if (state === 'empty' || state === 'failed' || !url) {
    return (
      <div
        className={`w-full bg-black/80 flex flex-col items-center justify-center gap-2 text-white/80 ${className ?? ''}`}
        style={{ minHeight: 220 }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="2.5" y="5" width="19" height="14" rx="3" />
          <path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" stroke="none" />
        </svg>
        <p className="text-sm font-medium">This video can&apos;t play right now</p>
        <button
          type="button"
          onClick={retry}
          className="text-xs px-3 py-1.5 rounded-full bg-white/12 hover:bg-white/20 transition-colors text-white/90"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div
        className={`w-full bg-black/80 flex items-center justify-center text-white/60 ${className ?? ''}`}
        style={{ minHeight: 220 }}
      >
        <Spinner label="Loading video…" />
      </div>
    );
  }

  if (embedId) {
    return (
      <div className={`relative w-full ${className ?? ''}`} style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
        <iframe
          src={`https://www.youtube.com/embed/${embedId}${controls ? '' : '?controls=0'}`}
          className="absolute top-0 left-0 w-full h-full rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
          onLoad={() => onPlay?.()}
        />
      </div>
    );
  }

  return (
    <video
      key={url} // remount when the presigned URL rotates
      src={url}
      poster={poster ?? undefined}
      className={className}
      controls={controls}
      muted={muted}
      playsInline
      preload="metadata"
      // Deliberately NO crossOrigin attribute: it would force the media request
      // into CORS mode and make playback depend on the bucket's CORS policy
      // allowing GET from this origin. Plain media loading needs no CORS, and
      // adding it is a common way to turn working video into a stalled player.
      onPlay={onPlay}
      onPause={onPause}
      onEnded={onEnded}
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      onError={handleError}
    />
  );
}

/** Helper: extract a YouTube video id from a plain (non-R2) media reference. */
function getYouTubeVideoId(value: string): string | null {
  if (!value) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
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
