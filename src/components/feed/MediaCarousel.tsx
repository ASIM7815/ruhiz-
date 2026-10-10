"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "./VideoPlayer";

function Img({ m }: { m: MediaItem }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className="grid size-full place-items-center bg-elev text-faint">
        <span className="flex flex-col items-center gap-2 text-[0.8rem]">
          <ImageOff className="size-6" /> Image unavailable
        </span>
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={m.url} alt={m.alt || "Photo"} loading="lazy" draggable={false} onError={() => setFailed(true)} className="size-full select-none object-cover" />;
}

/** Photo / video media with a multi-item carousel (arrows, dots, swipe, keyboard). */
export function MediaCarousel({ media, className }: { media: MediaItem[]; className?: string }) {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  if (!media.length) return null;

  if (media.length === 1) {
    const m = media[0];
    return m.type === "video" ? (
      <VideoPlayer media={m} className={className} />
    ) : (
      <div className={cn("max-h-[560px] overflow-hidden rounded-xl bg-elev ring-1 ring-white/10", className)}>
        <Img m={m} />
      </div>
    );
  }

  const go = (n: number) => setI(Math.max(0, Math.min(media.length - 1, n)));

  return (
    <div
      className={cn("group relative overflow-hidden rounded-xl bg-elev ring-1 ring-white/10", className)}
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
      <div className="flex transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
        {media.map((m, idx) => (
          <div key={m.id} className="aspect-[16/9] w-full shrink-0" aria-hidden={idx !== i}>
            {m.type === "video" ? <VideoPlayer media={m} className="!rounded-none !ring-0" /> : <Img m={m} />}
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
