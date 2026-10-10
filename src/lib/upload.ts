"use client";

import { api, ApiError } from "./api";

export const UPLOAD_LIMITS = {
  image: { maxMB: 10, accept: "image/jpeg,image/png,image/webp,image/gif", mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  video: { maxMB: 200, accept: "video/mp4,video/webm,video/quicktime", mimes: ["video/mp4", "video/webm", "video/quicktime"] },
  avatar: { maxMB: 5, accept: "image/jpeg,image/png,image/webp", mimes: ["image/jpeg", "image/png", "image/webp"] },
} as const;

/** Client-side pre-check so users get instant feedback. The server re-validates everything. */
export function checkFile(file: File, kind: keyof typeof UPLOAD_LIMITS) {
  const rule = UPLOAD_LIMITS[kind];
  if (!(rule.mimes as readonly string[]).includes(file.type)) return `“${file.name}” isn't a supported ${kind === "video" ? "video" : "image"} type.`;
  if (file.size > rule.maxMB * 1024 * 1024) return `“${file.name}” is larger than ${rule.maxMB} MB.`;
  return null;
}

/**
 * Upload flow: ask our server for a presigned URL → PUT directly to Neon Object Storage
 * (with progress) → ask our server to verify the object. Returns the media id.
 */
export async function uploadFile(
  file: Blob & { name?: string },
  opts: { purpose: "post" | "avatar"; kind: "image" | "video"; alt?: string; onProgress?: (pct: number) => void; signal?: AbortSignal },
) {
  const { id, uploadUrl, headers } = await api<{ id: string; uploadUrl: string; headers: Record<string, string> }>("/api/media", {
    body: { purpose: opts.purpose, kind: opts.kind, mime: file.type, size: file.size, alt: opts.alt ?? "" },
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, "The upload was rejected by storage.")));
    xhr.onerror = () => reject(new ApiError(0, "The upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled."));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  }).catch(async (e) => {
    await api(`/api/media/${id}`, { method: "DELETE" }).catch(() => {});
    throw e;
  });

  await api(`/api/media/${id}/complete`, { method: "POST", body: {} });
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
