"use client";

import { api, ApiError } from "./api";

const MB = 1024 * 1024;

/** Client-side pre-check limits. The server (src/server/storage.ts MEDIA_RULES) re-validates everything. */
export const UPLOAD_LIMITS = {
  image: { maxMB: 10, accept: "image/jpeg,image/png,image/webp,image/gif", mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  video: { maxMB: 1024, accept: "video/mp4,video/webm,video/quicktime", mimes: ["video/mp4", "video/webm", "video/quicktime"] },
  avatar: { maxMB: 5, accept: "image/jpeg,image/png,image/webp", mimes: ["image/jpeg", "image/png", "image/webp"] },
  banner: { maxMB: 8, accept: "image/jpeg,image/png,image/webp", mimes: ["image/jpeg", "image/png", "image/webp"] },
} as const;

const limitLabel = (mb: number) => (mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`);

/** Client-side pre-check so users get instant feedback. The server re-validates everything. */
export function checkFile(file: File, kind: keyof typeof UPLOAD_LIMITS) {
  const rule = UPLOAD_LIMITS[kind];
  if (!(rule.mimes as readonly string[]).includes(file.type)) return `“${file.name}” isn't a supported ${kind === "video" ? "video" : "image"} type.`;
  if (file.size > rule.maxMB * MB) return `“${file.name}” is larger than ${limitLabel(rule.maxMB)}.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

/**
 * Reads a file's intrinsic pixel size in the browser (display orientation, so a phone video shot
 * in portrait reports portrait). Returns null if it can't be read in a few seconds; the feed then
 * falls back to measuring the file when it loads. The file itself is never modified.
 */
export function measureMedia(file: Blob, kind: "image" | "video"): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = kind === "image" ? new Image() : document.createElement("video");
    const done = (v: { width: number; height: number } | null) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = window.setTimeout(() => done(null), 5000);
    if (el instanceof HTMLVideoElement) {
      el.preload = "metadata";
      el.muted = true;
      el.onloadedmetadata = () => done(el.videoWidth && el.videoHeight ? { width: el.videoWidth, height: el.videoHeight } : null);
    } else {
      el.onload = () => done(el.naturalWidth && el.naturalHeight ? { width: el.naturalWidth, height: el.naturalHeight } : null);
    }
    el.onerror = () => done(null);
    el.src = url;
  });
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (window.clearTimeout(t), reject(new ApiError(0, "Upload cancelled."))), { once: true });
  });

/** One PUT straight to storage. Resolves with the ETag (exposed by the bucket's CORS rule). */
function putBlob(url: string, blob: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError(0, "Upload cancelled."));
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.getResponseHeader("ETag") ?? "");
      reject(new ApiError(xhr.status, xhr.status === 403 ? "Storage refused the upload (its link may have expired)." : `Storage rejected the upload (HTTP ${xhr.status}).`));
    };
    // A network failure here is also what a missing CORS rule / bucket looks like to the browser.
    xhr.onerror = () => reject(new ApiError(0, "The connection to storage failed."));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/** Retries transient failures (network, 5xx, expired links) with backoff. Cancellation and 4xx (other than 403) are final. */
async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal, attempts = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as ApiError).status ?? 0;
      const transient = !signal?.aborted && (status === 0 || status === 403 || status === 408 || status === 429 || status >= 500);
      if (!transient || i >= attempts - 1) throw e;
      await sleep(Math.min(8000, 700 * 2 ** i), signal);
    }
  }
}

export interface UploadOptions {
  purpose: "post" | "avatar" | "banner";
  kind: "image" | "video";
  alt?: string;
  /** 0–100 */
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

/**
 * Upload flow: ask our server for an upload → send bytes directly to Neon Object Storage → ask our
 * server to verify the stored object. Large videos go up in 16 MB parts, three at a time; each part is
 * retried on its own, so a dropped connection only costs that part. Returns the media id.
 */
export async function uploadFile(file: Blob & { name?: string }, opts: UploadOptions) {
  const dims = await measureMedia(file, opts.kind);
  const start = await api<
    { id: string; uploadUrl: string; headers: Record<string, string>; multipart?: undefined } | { id: string; multipart: { partSize: number; partCount: number } }
  >("/api/media", {
    body: { purpose: opts.purpose, kind: opts.kind, mime: file.type, size: file.size, alt: opts.alt ?? "", ...(dims ?? {}) },
  });
  const id = start.id;
  const report = (loaded: number) => opts.onProgress?.(Math.min(99, Math.round((loaded / file.size) * 100)));

  try {
    if (!start.multipart) {
      const { uploadUrl, headers } = start;
      await withRetry(() => putBlob(uploadUrl, file, headers, report, opts.signal), opts.signal);
      await api(`/api/media/${id}/complete`, { method: "POST", body: {} });
    } else {
      const { partSize, partCount } = start.multipart;
      const loaded = new Array<number>(partCount).fill(0);
      const etags = new Array<string>(partCount).fill("");
      const urls = new Map<number, string>();
      const urlFor = async (n: number, fresh = false) => {
        if (fresh || !urls.has(n)) {
          // Fetch URLs in batches of up to 20 to keep requests to our API low.
          const batch = fresh ? [n] : Array.from({ length: Math.min(20, partCount - n + 1) }, (_, i) => n + i).filter((x) => !urls.has(x));
          const r = await api<{ parts: { partNumber: number; url: string }[] }>(`/api/media/${id}/parts`, { body: { parts: batch } });
          for (const p of r.parts) urls.set(p.partNumber, p.url);
        }
        return urls.get(n)!;
      };
      let next = 1;
      const worker = async () => {
        while (next <= partCount) {
          const n = next++;
          const blob = file.slice((n - 1) * partSize, Math.min(file.size, n * partSize));
          let attempt = 0;
          etags[n - 1] = await withRetry(async () => {
            loaded[n - 1] = 0;
            const url = await urlFor(n, attempt++ > 0); // a fresh signature on every retry
            return putBlob(url, blob, {}, (b) => ((loaded[n - 1] = b), report(loaded.reduce((a, x) => a + x, 0))), opts.signal);
          }, opts.signal);
          if (!etags[n - 1]) throw new ApiError(0, "Storage didn't confirm a part of the video. Please try again.");
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, partCount) }, worker));
      await withRetry(
        () => api(`/api/media/${id}/complete`, { method: "POST", body: { parts: etags.map((etag, i) => ({ partNumber: i + 1, etag })) } }),
        opts.signal,
        3,
      );
    }
  } catch (e) {
    // Clean up the reservation (and, for multipart, the stored parts) so nothing is left behind.
    await api(`/api/media/${id}`, { method: "DELETE" }).catch(() => {});
    throw e;
  }
  opts.onProgress?.(100);
  return id;
}

/** Square-crops and downsizes an image to a 512px WebP for profile pictures. */
export async function toAvatarBlob(file: File, zoom = 1, offset = { x: 0, y: 0 }): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const side = Math.min(bitmap.width, bitmap.height) / zoom;
  const sx = Math.max(0, Math.min(bitmap.width - side, (bitmap.width - side) / 2 + offset.x * (bitmap.width - side) / 2));
  const sy = Math.max(0, Math.min(bitmap.height - side, (bitmap.height - side) / 2 + offset.y * (bitmap.height - side) / 2));
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/webp", 0.9));
}

/**
 * Prepares a profile banner: a 3:1 copy (1500 × 500, or smaller if the source is smaller) centred
 * on the chosen focus point. The user's original file is not modified or uploaded.
 */
export async function toBannerBlob(file: File, focusY = 0.5): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = 3;
  let sw = bitmap.width;
  let sh = Math.round(sw / ratio);
  if (sh > bitmap.height) {
    sh = bitmap.height;
    sw = Math.round(sh * ratio);
  }
  const sx = Math.round((bitmap.width - sw) / 2);
  const sy = Math.round(Math.max(0, Math.min(bitmap.height - sh, focusY * bitmap.height - sh / 2)));
  const outW = Math.min(1500, sw);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = Math.round(outW / ratio);
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/webp", 0.88));
}
