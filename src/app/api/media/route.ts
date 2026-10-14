import { randomUUID } from "node:crypto";
import { body, route } from "@/server/http";
import { one, q } from "@/server/db";
import { ApiError, badRequest } from "@/server/errors";
import { presign } from "@/server/schemas";
import {
  bucketFor,
  createMultipart,
  DAILY_VIDEO_BYTES,
  ensureBucket,
  EXT,
  MEDIA_RULES,
  MULTIPART_THRESHOLD,
  PART_SIZE,
  presignPut,
  storageConfigured,
  sweepAbandonedUploads,
} from "@/server/storage";

const unavailable = () =>
  new ApiError(503, "Uploads are temporarily unavailable because the storage bucket can't be reached. Please try again later.", "STORAGE_UNAVAILABLE");

/**
 * Step 1 of an upload: validate type and declared size, reserve a DB row, and return either one
 * presigned PUT (small files) or a multipart upload (videos over 16 MB, sent in 16 MB parts).
 * The declared size is only a reservation: every URL is bound to exact byte lengths, and
 * /complete re-checks the real stored size, type and file signature.
 */
export const POST = route({ rateLimit: { key: "upload", limit: 60, windowSec: 3600 } }, async ({ req, viewer }) => {
  if (!storageConfigured()) throw new ApiError(503, "Photo and video uploads aren't available yet. Storage credentials are not configured.", "STORAGE_UNCONFIGURED");
  const p = await body(req, presign);
  if (p.purpose !== "post" && p.kind !== "image") throw badRequest("Profile pictures and banners must be images.");
  const rules = p.purpose === "post" ? MEDIA_RULES[p.kind] : MEDIA_RULES[p.purpose];
  if (!(rules.mimes as readonly string[]).includes(p.mime)) throw new ApiError(415, `Unsupported file type. Allowed: ${rules.mimes.map((m) => EXT[m]).join(", ")}.`, "UNSUPPORTED_TYPE");
  if (p.size > rules.maxBytes) throw new ApiError(413, `File is too large. The limit is ${rules.maxBytes >= 1024 ** 3 ? "1 GB" : `${Math.round(rules.maxBytes / 1024 / 1024)} MB`}.`, "TOO_LARGE");

  // Abuse limits: unfinished uploads, and total video volume per day.
  const usage = await one<{ pending: number; video_bytes: string }>(
    `select count(*) filter (where status = 'pending')::int as pending,
            coalesce(sum(size_bytes) filter (where kind = 'video'), 0)::bigint as video_bytes
       from media where owner_id = $1 and created_at > now() - interval '1 day'`,
    [viewer.id],
  );
  if ((usage?.pending ?? 0) > 40) throw new ApiError(429, "Too many unfinished uploads. Please try again later.", "RATE_LIMITED");
  if (p.kind === "video" && Number(usage?.video_bytes ?? 0) + p.size > DAILY_VIDEO_BYTES)
    throw new ApiError(429, "You've reached today's video upload allowance (5 GB). Please try again tomorrow.", "QUOTA");

  // Occasionally clean up uploads other sessions abandoned.
  if (Math.random() < 0.05) sweepAbandonedUploads().catch(() => {});

  const now = new Date();
  const key = `u/${viewer.id}/${p.purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT[p.mime]}`;
  const bucket = bucketFor(p.kind);
  try {
    await ensureBucket(bucket);
  } catch {
    throw unavailable();
  }

  const multipart = p.kind === "video" && p.size > MULTIPART_THRESHOLD;
  let uploadId: string | null = null;
  if (multipart) {
    try {
      uploadId = await createMultipart(bucket, key, p.mime);
    } catch {
      throw unavailable();
    }
  }
  const dims = p.width && p.height ? [p.width, p.height] : [null, null];
  const [row] = await q<{ id: string }>(
    `insert into media (owner_id, purpose, kind, bucket, object_key, mime, size_bytes, alt, width, height, upload_id, part_size)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
    [viewer.id, p.purpose, p.kind, bucket, key, p.mime, p.size, p.alt, dims[0], dims[1], uploadId, multipart ? PART_SIZE : null],
  );
  if (multipart) return { id: row.id, multipart: { partSize: PART_SIZE, partCount: Math.ceil(p.size / PART_SIZE) } };
  const uploadUrl = await presignPut(bucket, key, p.mime, p.size);
  return { id: row.id, uploadUrl, headers: { "Content-Type": p.mime } };
});
