import { z } from "zod";
import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { completeMultipart, headObject, MEDIA_RULES, readHead, signatureMatches } from "@/server/storage";

const completeBody = z
  .object({ parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10000), etag: z.string().trim().min(1).max(200) })).max(10000).optional() })
  .strict();

/**
 * Step 2: (for multipart uploads, assemble the parts) then confirm the stored object really is the
 * declared type and size. The real size comes from storage, never from the client.
 */
export const POST = route<{ id: string }>({}, async ({ req, viewer, params }) => {
  const id = parseId(params.id);
  const raw = await req.json().catch(() => ({}));
  const input = completeBody.parse(raw ?? {});
  const m = await one<{ bucket: string; object_key: string; mime: string; size_bytes: string; status: string; kind: "image" | "video"; purpose: string; upload_id: string | null; part_size: number | null }>(
    `select bucket, object_key, mime, size_bytes, status, kind, purpose, upload_id, part_size from media where id = $1 and owner_id = $2`,
    [id, viewer.id],
  );
  if (!m) throw notFound("Upload not found.");
  if (m.status === "ready") return { id, url: `/api/media/${id}` };

  const reject = async (msg: string) => {
    await q(`insert into storage_gc (object_key, bucket, reason) values ($1, $2, 'failed validation') on conflict do nothing`, [m.object_key, m.bucket]);
    await q(`delete from media where id = $1`, [id]);
    throw new ApiError(422, msg, "INVALID_FILE");
  };

  if (m.upload_id) {
    const count = Math.ceil(Number(m.size_bytes) / Number(m.part_size));
    const parts = [...(input.parts ?? [])].sort((a, b) => a.partNumber - b.partNumber);
    if (parts.length !== count || parts.some((p, i) => p.partNumber !== i + 1)) throw badRequest(`All ${count} parts are needed to finish this upload.`);
    try {
      await completeMultipart(m.bucket, m.object_key, m.upload_id, parts);
    } catch (e) {
      // Usually a part that didn't arrive. The client can re-send that part and complete again.
      throw new ApiError(409, "Some parts of the video didn't arrive. Retrying the upload should fix it.", "PARTS_INCOMPLETE");
    }
    await q(`update media set upload_id = null where id = $1`, [id]);
  }

  let head;
  try {
    head = await headObject(m.bucket, m.object_key);
  } catch {
    throw new ApiError(409, "The file hasn't finished uploading.", "NOT_UPLOADED");
  }
  const limit = m.purpose === "post" ? MEDIA_RULES[m.kind].maxBytes : MEDIA_RULES[m.purpose as "avatar" | "banner"].maxBytes;
  if (head.size > limit) await reject("The uploaded file is larger than the limit.");
  if (head.size !== Number(m.size_bytes)) await reject("The uploaded file size doesn't match.");
  if (head.contentType && head.contentType !== m.mime) await reject("The uploaded file type doesn't match.");
  if (!signatureMatches(m.mime, await readHead(m.bucket, m.object_key))) await reject("That file isn't a valid image or video.");

  await q(`update media set status = 'ready' where id = $1`, [id]);
  return { id, url: `/api/media/${id}` };
});
