"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import type { Me } from "@/lib/types";
import { api } from "@/lib/api";
import { checkFile, toBannerBlob, UPLOAD_LIMITS, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";

/**
 * Profile banner: 3:1 everywhere (1500 × 500 source), `object-fit: cover`, so the whole stored image
 * shows without distortion on every screen. Without a banner, a brand gradient is shown.
 * The bottom fade keeps the overlapping avatar and the controls readable on any image.
 */
export function ProfileBanner({ src, editable, onChanged }: { src: string | null; editable?: boolean; onChanged?: () => void }) {
  const { actions } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<number | "remove" | null>(null);
  const [failed, setFailed] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkFile(file, "banner");
    if (problem) return actions.toast(problem, "error");
    setBusy(0);
    try {
      const blob = await toBannerBlob(file);
      const id = await uploadFile(blob, { purpose: "banner", kind: "image", onProgress: (p) => setBusy(p) });
      actions.setMe(await api<Me>("/api/me", { method: "PATCH", body: { bannerMediaId: id } }));
      setFailed(false);
      onChanged?.();
      actions.toast("Banner updated", "success");
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      actions.setMe(await api<Me>("/api/me", { method: "PATCH", body: { bannerMediaId: null } }));
      onChanged?.();
    } catch (e) {
      actions.toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative aspect-[3/1] w-full overflow-hidden bg-elev">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover object-center" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(600px_200px_at_20%_0%,rgba(47,123,255,.45),transparent),radial-gradient(500px_200px_at_90%_100%,rgba(255,46,85,.25),transparent)]" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--card-solid)] via-[var(--card-solid)]/10 to-transparent" />
      {editable && (
        <div className="absolute right-3 top-3 flex gap-2">
          <input ref={input} type="file" accept={UPLOAD_LIMITS.banner.accept} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a banner image" />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy !== null}
            className={cn("btn btn-sm border border-white/20 bg-black/55 text-white backdrop-blur hover:bg-black/70")}
          >
            {typeof busy === "number" ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {typeof busy === "number" ? `${busy}%` : src ? "Change banner" : "Add banner"}
          </button>
          {src && (
            <button type="button" onClick={remove} disabled={busy !== null} className="btn btn-sm btn-icon border border-white/20 bg-black/55 text-white backdrop-blur hover:bg-black/70" aria-label="Remove banner">
              {busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
