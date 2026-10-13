import { randomUUID } from "node:crypto";
import { body, route } from "@/server/http";
import { q } from "@/server/db";
import { ApiError, badRequest } from "@/server/errors";
import { presign } from "@/server/schemas";
import { bucketFor, EXT, MEDIA_RULES, presignPut, storageConfigured } from "@/server/storage";

/**
 * Step 1 of an upload: validate type/size, reserve a DB row, and return a short-lived
 * presigned PUT bound to that exact key, content type and length.
 */
export const POST = route({ rateLimit: { key: "upload", limit: 60, windowSec: 3600 } }, async ({ req, viewer }) => {
  if (!storageConfigured()) throw new ApiError(503, "Photo and video uploads aren't available yet. Storage credentials are not configured.", "STORAGE_UNCONFIGURED");
  const p = await body(req, presign);
  if (p.purpose === "avatar" && p.kind !== "image") throw badRequest("Profile pictures must be images.");
  const rules = p.purpose === "avatar" ? MEDIA_RULES.avatar : MEDIA_RULES[p.kind];
  if (!(rules.mimes as readonly string[]).includes(p.mime)) throw new ApiError(415, `Unsupported file type. Allowed: ${rules.mimes.map((m) => EXT[m]).join(", ")}.`, "UNSUPPORTED_TYPE");
  if (p.size > rules.maxBytes) throw new ApiError(413, `File is too large. The limit is ${Math.round(rules.maxBytes / 1024 / 1024)} MB.`, "TOO_LARGE");

  // Limit abandoned uploads per user.
  const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from media where owner_id = $1 and status = 'pending' and created_at > now() - interval '1 day'`, [viewer.id]);
  if (n > 40) throw new ApiError(429, "Too many unfinished uploads. Please try again later.", "RATE_LIMITED");

  const now = new Date();
  const key = `u/${viewer.id}/${p.purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT[p.mime]}`;
  const bucket = bucketFor(p.kind);
  const [row] = await q<{ id: string }>(
    `insert into media (owner_id, purpose, kind, bucket, object_key, mime, size_bytes, alt, width, height) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [viewer.id, p.purpose, p.kind, bucket, key, p.mime, p.size, p.alt, p.width && p.height ? p.width : null, p.width && p.height ? p.height : null],
  );
  const uploadUrl = await presignPut(bucket, key, p.mime, p.size);
  return { id: row.id, uploadUrl, headers: { "Content-Type": p.mime } };
});
