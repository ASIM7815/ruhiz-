"use client";

import { useRef, useState } from "react";
import { Maximize, Pause, Play, VideoOff, Volume2, VolumeX } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

/** Native video player with custom controls. Streams from storage via a short-lived signed URL. */
export function VideoPlayer({ media, className }: { media: Pick<MediaItem, "url" | "alt">; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    setStarted(true);
    if (v.paused) v.play().catch(() => setFailed(true));
    else v.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const v = vid.current;
    if (!v || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * dur;
  };

  if (failed)
    return (
      <div className={cn("grid aspect-video place-items-center rounded-xl bg-elev text-faint ring-1 ring-white/10", className)}>
        <span className="flex flex-col items-center gap-2 text-[0.82rem]">
          <VideoOff className="size-6" /> This video couldn't be played.
        </span>
      </div>
    );

  const pct = dur ? (t / dur) * 100 : 0;

  return (
    <div
      ref={box}
      className={cn("group relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-white/10", className)}
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-label={playing ? "Pause video" : `Play video${media.alt ? `: ${media.alt}` : ""}`}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <video
        ref={vid}
        src={`${media.url}#t=0.1`}
        muted={muted}
        playsInline
        preload="metadata"
        className="size-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />

      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10 transition-opacity", playing ? "opacity-0 group-hover:opacity-100" : "opacity-100")} />

      {!playing && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white/85 bg-black/35 backdrop-blur-sm transition-transform group-hover:scale-105">
          <Play className="ml-1 size-7 fill-white text-white" />
        </span>
      )}

      {!started && dur > 0 && <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/65 px-2 py-0.5 font-code text-[0.78rem] font-semibold text-white">{formatDuration(dur)}</span>}

      {started && (
        <div className={cn("absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-6 transition-opacity", playing ? "opacity-0 focus-within:opacity-100 group-hover:opacity-100" : "opacity-100")} onClick={(e) => e.stopPropagation()}>
          <div className="relative h-4 cursor-pointer" onClick={seek} role="slider" aria-label="Seek" aria-valuenow={Math.round(t)} aria-valuemin={0} aria-valuemax={Math.round(dur)}>
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25" />
            <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `${pct}%` }} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-white">
            <button onClick={toggle} className="grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="size-4.5 fill-white" /> : <Play className="size-4.5 fill-white" />}
            </button>
            <button onClick={() => setMuted((m) => !m)} className="grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
            </button>
            <span className="font-code text-[0.76rem] tabular-nums">
              {formatDuration(t)} / {formatDuration(dur)}
            </span>
            <button onClick={() => box.current?.requestFullscreen?.().catch(() => {})} className="ml-auto grid size-8 place-items-center rounded-full hover:bg-white/15" aria-label="Fullscreen">
              <Maximize className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
