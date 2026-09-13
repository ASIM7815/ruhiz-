export function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload media through the existing Cloudflare R2 pipeline
 * (/api/upload -> R2 PutObject, /api/media -> presigned GET url).
 * Falls back to an in-browser data URL / object URL when the
 * backend storage isn't configured, so the app keeps working in demo mode.
 */
export async function uploadMedia(
  file: File | Blob,
  type: 'image' | 'video',
  onProgress?: (pct: number) => void
): Promise<{ url: string; storage: 'r2' | 'local' }> {
  onProgress?.(15);
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      const json = await res.json();
      if (json?.filename) {
        onProgress?.(70);
        try {
          const mediaRes = await fetch(`/api/media?key=${encodeURIComponent(json.filename)}`);
          if (mediaRes.ok) {
            const mediaJson = await mediaRes.json();
            if (mediaJson?.url) {
              onProgress?.(100);
              return { url: mediaJson.url, storage: 'r2' };
            }
          }
        } catch {
          /* fall through to key-based url */
        }
        onProgress?.(100);
        return { url: json.url ?? json.filename, storage: 'r2' };
      }
    }
  } catch {
    /* demo fallback below */
  }

  // Fallback: small images become data URLs (persist in localStorage),
  // larger media stays as an object URL for this session.
  if (type === 'image' && file.size <= 3.5 * 1024 * 1024) {
    const dataUrl = await fileToDataURL(file);
    onProgress?.(100);
    return { url: dataUrl, storage: 'local' };
  }
  const objUrl = URL.createObjectURL(file);
  onProgress?.(100);
  return { url: objUrl, storage: 'local' };
}

export async function blobToFile(blob: Blob, name: string): Promise<File> {
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}
