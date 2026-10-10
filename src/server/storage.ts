import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { q } from "./db";

/** Server-only Neon Object Storage client. Credentials never leave the server. */
let s3: S3Client | null = null;
function client() {
  if (!env.storage.configured) throw new Error("storage-not-configured");
  if (!s3) {
    s3 = new S3Client({
      endpoint: env.storage.endpoint,
      region: env.storage.region,
      forcePathStyle: true, // Neon storage supports path-style only
      credentials: { accessKeyId: env.storage.accessKeyId, secretAccessKey: env.storage.secretAccessKey },
      // Keep presigned URLs to the documented SigV4 parameters only.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return s3;
}

export const storageConfigured = () => env.storage.configured;

export const bucketFor = (kind: "image" | "video") => (kind === "image" ? env.storage.imagesBucket : env.storage.videoBucket);

export const MEDIA_RULES = {
  image: { maxBytes: 10 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  video: { maxBytes: 200 * 1024 * 1024, mimes: ["video/mp4", "video/webm", "video/quicktime"] },
  avatar: { maxBytes: 5 * 1024 * 1024, mimes: ["image/jpeg", "image/png", "image/webp"] },
} as const;

export const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Presigned PUT bound to the exact key, content type and byte length. */
export async function presignPut(bucket: string, key: string, mime: string, size: number) {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: size });
  return getSignedUrl(client(), cmd, { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length"]) });
}

export async function presignGet(bucket: string, key: string, expiresIn: number) {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function headObject(bucket: string, key: string) {
  const r = await client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { size: Number(r.ContentLength ?? 0), contentType: (r.ContentType ?? "").toLowerCase() };
}

export async function readHead(bucket: string, key: string, bytes = 16) {
  const r = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
  const buf = await r.Body?.transformToByteArray();
  return buf ?? new Uint8Array();
}

/** File-signature check so a renamed executable/HTML file can't pose as media. */
export function signatureMatches(mime: string, b: Uint8Array) {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  const ascii = (i: number, s: string) => [...s].every((c, j) => b[i + j] === c.charCodeAt(0));
  switch (mime) {
    case "image/jpeg":
      return at(0, 0xff, 0xd8, 0xff);
    case "image/png":
      return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/gif":
      return ascii(0, "GIF87a") || ascii(0, "GIF89a");
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "video/mp4":
    case "video/quicktime":
      return ascii(4, "ftyp") || ascii(4, "moov") || ascii(4, "mdat") || ascii(4, "wide");
    case "video/webm":
      return at(0, 0x1a, 0x45, 0xdf, 0xa3);
    default:
      return false;
  }
}

/**
 * Deletes objects whose DB rows are gone. Keys are first queued in storage_gc (inside
 * the same transaction as the row delete), so nothing is orphaned if storage is down.
 */
export async function drainStorageQueue(limit = 200) {
  if (!storageConfigured()) return { deleted: 0, pending: true };
  const rows = await q<{ object_key: string; bucket: string }>(
    `select object_key, bucket from storage_gc order by queued_at limit $1`,
    [limit],
  );
  let deleted = 0;
  const byBucket = new Map<string, string[]>();
  for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.object_key]);
  for (const [bucket, keys] of byBucket) {
    try {
      await client().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
      await q(`delete from storage_gc where object_key = any($1::text[])`, [keys]);
      deleted += keys.length;
    } catch (e) {
      await q(`update storage_gc set attempts = attempts + 1, last_error = $2 where object_key = any($1::text[])`, [keys, String((e as Error).message).slice(0, 300)]);
    }
  }
  return { deleted, pending: false };
}
