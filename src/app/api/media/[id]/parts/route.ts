import { z } from "zod";
import { body, parseId, route } from "@/server/http";
import { one } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { presignPart } from "@/server/storage";

const partsBody = z.object({ parts: z.array(z.number().int().min(1).max(10000)).min(1).max(20) }).strict();

/** Presigned URLs for up to 20 parts of the caller's own unfinished multipart upload. */
export const POST = route<{ id: string }>({ rateLimit: { key: "upload-parts", limit: 2000, windowSec: 3600 } }, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const { parts } = await body(req, partsBody);
  const m = await one<{ bucket: string; object_key: string; upload_id: string | null; part_size: number | null; size_bytes: string }>(
    `select bucket, object_key, upload_id, part_size, size_bytes from media where id = $1 and owner_id = $2 and status = 'pending'`,
    [id, viewer.id],
  );
  if (!m) throw notFound("Upload not found.");
  if (!m.upload_id || !m.part_size) throw badRequest("This upload doesn't use parts.");
  const size = Number(m.size_bytes);
  const count = Math.ceil(size / m.part_size);
  const out: { partNumber: number; url: string }[] = [];
  for (const n of new Set(parts)) {
    if (n > count) throw badRequest(`Part ${n} is outside this upload (it has ${count} parts).`);
    const length = n < count ? m.part_size : size - m.part_size * (count - 1);
    out.push({ partNumber: n, url: await presignPart(m.bucket, m.object_key, m.upload_id, n, length) });
  }
  return { parts: out };
});
