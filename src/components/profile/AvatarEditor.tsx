"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash, Upload } from "lucide-react";
import { checkFile, toAvatarBlob, UPLOAD_LIMITS, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Profile picture picker: choose → square crop with zoom/position → preview at real sizes →
 * upload to the `images` bucket. Calls onChange with the new media id (or null to remove).
 */
export function AvatarEditor({ code, currentUrl, identity, onChange }: { code: string; currentUrl: string | null; identity: "saver" | "revealer"; onChange: (mediaId: string | null, previewUrl: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [state, setState] = useState<"idle" | "cropping" | "uploading" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = checkFile(f, "avatar");
    if (problem) return setError(problem);
    setError(null);
    setFile(f);
    setSrc(URL.createObjectURL(f));
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setState("cropping");
  };

  const confirm = async () => {
    if (!file) return;
    setState("uploading");
    setError(null);
    try {
      const blob = await toAvatarBlob(file, zoom, pos);
      const url = URL.createObjectURL(blob);
      const id = await uploadFile(blob, { purpose: "avatar", kind: "image", alt: `Profile picture of #${code}`, onProgress: setProgress });
      setPreview(url);
      onChange(id, url);
      setState("done");
    } catch (e) {
      setError((e as Error).message);
      setState("cropping");
    }
  };

  // Drag-to-position inside the crop window.
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  return (
    <div className="rounded-xl border border-line bg-black/15 p-3.5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <Avatar code={code} src={preview} size="2xl" />
          <button type="button" onClick={() => input.current?.click()} className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border border-line-strong bg-brand text-white shadow-lg hover:bg-brand-2" aria-label="Change profile picture">
            <Camera className="size-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9rem] font-semibold text-ink">Profile picture</p>
          <p className="text-[0.78rem] text-muted">JPG, PNG or WebP up to {UPLOAD_LIMITS.avatar.maxMB} MB. It's cropped to a square.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} className="btn btn-outline btn-sm">
              <Upload className="size-3.5" /> {preview ? "Change photo" : "Upload photo"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  onChange(null, null);
                  setState("idle");
                }}
                className="btn btn-ghost btn-sm text-muted"
              >
                <Trash className="size-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
        <input ref={input} type="file" hidden accept={UPLOAD_LIMITS.avatar.accept} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      </div>

      {identity === "saver" && state === "cropping" && (
        <p className="mt-3 rounded-lg border border-sky-400/20 bg-sky-500/[.07] px-3 py-2 text-[0.78rem] text-sky-100/90">
          You're using Identity Saver. A real photo of yourself may make you recognisable. A neutral image works just as well.
        </p>
      )}

      {(state === "cropping" || state === "uploading") && src && (
        <div className="mt-3.5 grid gap-4 sm:grid-cols-[220px_1fr]">
          <div
            className="relative size-[220px] cursor-grab touch-none overflow-hidden rounded-xl bg-black active:cursor-grabbing"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const k = 2 / (220 * zoom);
              setPos({ x: Math.max(-1, Math.min(1, drag.current.px - (e.clientX - drag.current.x) * k)), y: Math.max(-1, Math.min(1, drag.current.py - (e.clientY - drag.current.y) * k)) });
            }}
            onPointerUp={() => (drag.current = null)}
            tabIndex={0}
            role="application"
            aria-label="Crop area. Use arrow keys to move and plus or minus to zoom."
            onKeyDown={(e) => {
              const step = 0.08;
              if (e.key === "ArrowLeft") setPos((p) => ({ ...p, x: Math.max(-1, p.x - step) }));
              if (e.key === "ArrowRight") setPos((p) => ({ ...p, x: Math.min(1, p.x + step) }));
              if (e.key === "ArrowUp") setPos((p) => ({ ...p, y: Math.max(-1, p.y - step) }));
              if (e.key === "ArrowDown") setPos((p) => ({ ...p, y: Math.min(1, p.y + step) }));
              if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(3, z + 0.1));
              if (e.key === "-") setZoom((z) => Math.max(1, z - 0.1));
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Crop preview"
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full select-none object-cover"
              style={{ transform: `scale(${zoom})`, objectPosition: `${50 + pos.x * 50}% ${50 + pos.y * 50}%` }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(2,5,15,.6)] ring-2 ring-white/80" />
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-[0.8rem] font-semibold text-ink-2">Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="mt-1 w-full accent-[#2f7bff]" />
            </label>
            <p className="text-[0.76rem] text-muted">Drag the image to position it inside the circle.</p>
            <div className="flex gap-2">
              <button type="button" onClick={confirm} disabled={state === "uploading"} className="btn btn-blue btn-sm">
                {state === "uploading" ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> {progress}%
                  </>
                ) : (
                  "Use this photo"
                )}
              </button>
              <button type="button" onClick={() => setState(preview ? "done" : "idle")} disabled={state === "uploading"} className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className={cn("mt-3 text-[0.8rem] text-rose-300")}>{error}</p>}
    </div>
  );
}
