"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MEDIA_MAX_VH, VideoPlayer } from "./VideoPlayer";

/*
 * Full-media display for the feed and post pages.
 *
 * Rule: show the entire file at its own aspect ratio. Nothing here uses `object-cover`.
 * Cropped square thumbnails (profile grids, Explore rows, the composer's chips) are separate on
 * purpose and always link through to this full view.
 */

const ratioOf = (m: Pick<MediaItem, "width" | "height">) => (m.width && m.height ? m.width / m.height : null);

/** One image shown whole. Its box takes the image's own ratio, capped to 80% of the viewport height. */
function FullImage({ m, className }: { m: MediaItem; className?: string }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const w = m.width ?? natural?.w ?? null;
  const h = m.height ?? natural?.h ?? null;
  const r = w && h ? w / h : null;

  if (failed)
    return (
      <div className={cn("grid aspect-[4/3] place-items-center rounded-xl bg-elev text-faint ring-1 ring-white/10", className)}>
        <span className="flex flex-col items-center gap-2 text-[0.8rem]">
          <ImageOff className="size-6" /> Image unavailable
        </span>
      </div>
    );

  return (
    <div
      className={cn("feed-media mx-auto w-full overflow-hidden rounded-xl bg-[#050816] ring-1 ring-white/10", className)}
      // Without a known size, hold a neutral 4:3 slot until the image loads, then switch to its real ratio.
      style={r && w ? { maxWidth: `min(${w}px, calc(${MEDIA_MAX_VH}vh * ${r}))` } : { aspectRatio: "4 / 3" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.url}
        alt={m.alt || "Photo"}
        width={w ?? undefined}
        height={h ?? undefined}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={(e) => !m.width && setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        onError={() => setFailed(true)}
        className="feed-media-image"
        style={r ? { aspectRatio: `${r}` } : undefined}
      />
    </div>
  );
}

/** Slide inside the carousel stage: media is contained, never cropped. */
function Slide({ m, active, onRatio }: { m: MediaItem; active: boolean; onRatio: (id: string, r: number) => void }) {
  const [failed, setFailed] = useState(false);
  if (m.type === "video") return <VideoPlayer media={m} fill onRatio={(r) => onRatio(m.id, r)} className="!rounded-none !ring-0" />;
  if (failed)
    return (
      <div className="absolute inset-0 grid place-items-center bg-elev text-faint">
        <span className="flex flex-col items-center gap-2 text-[0.8rem]">
          <ImageOff className="size-6" /> Image unavailable
        </span>
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.url}
      alt={m.alt || "Photo"}
      loading={active ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onLoad={(e) => !m.width && onRatio(m.id, e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
      onError={() => setFailed(true)}
      className="absolute inset-0 size-full select-none object-contain object-center"
    />
  );
}

/** Photos and videos for a post: one item is shown whole; several become a swipeable carousel. */
export function MediaCarousel({ media, className }: { media: MediaItem[]; className?: string }) {
  const [i, setI] = useState(0);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const touch = useRef<number | null>(null);
  if (!media.length) return null;

  if (media.length === 1) {
    const m = media[0];
    return m.type === "video" ? <VideoPlayer media={m} className={className} /> : <FullImage m={m} className={className} />;
  }

  const go = (n: number) => setI(Math.max(0, Math.min(media.length - 1, n)));
  // The stage takes the shape of the slide on screen, so each item fills it exactly with no bars.
  const stageRatio = ratioOf(media[i]) ?? measured[media[i].id] ?? 4 / 3;

  return (
    <div
      className={cn("group relative w-full overflow-hidden rounded-xl bg-[#050816] ring-1 ring-white/10 transition-[aspect-ratio] duration-300", className)}
      style={{ aspectRatio: `${stageRatio}`, maxHeight: `${MEDIA_MAX_VH}vh` }}
      role="region"
      aria-roledescription="carousel"
      aria-label={`Media, ${i + 1} of ${media.length}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      <div className="absolute inset-0 flex transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {media.map((m, idx) => (
          <div key={m.id} className="relative h-full w-full shrink-0" aria-hidden={idx !== i}>
            <Slide m={m} active={Math.abs(idx - i) <= 1} onRatio={(id, r) => setMeasured((s) => (s[id] === r ? s : { ...s, [id]: r }))} />
          </div>
        ))}
      </div>

      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[0.74rem] font-semibold text-white backdrop-blur">
        {i + 1} / {media.length}
      </span>

      {i > 0 && (
        <button onClick={() => go(i - 1)} className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0a1638] opacity-0 shadow-lg transition-opacity hover:bg-white focus:opacity-100 group-hover:opacity-100" aria-label="Previous">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {i < media.length - 1 && (
        <button onClick={() => go(i + 1)} className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#0a1638] opacity-0 shadow-lg transition-opacity hover:bg-white focus:opacity-100 group-hover:opacity-100" aria-label="Next">
          <ChevronRight className="size-5" />
        </button>
      )}

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {media.map((m, idx) => (
          <button key={m.id} onClick={() => go(idx)} aria-label={`Go to item ${idx + 1}`} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80")} />
        ))}
      </div>
    </div>
  );
}
