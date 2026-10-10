import { parseId, route } from "@/server/http";
import { one, q } from "@/server/db";
import { ApiError, notFound } from "@/server/errors";
import { headObject, readHead, signatureMatches } from "@/server/storage";

/** Step 2: confirm the object exists and really is the declared type and size. */
export const POST = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const m = await one<{ bucket: string; object_key: string; mime: string; size_bytes: string; status: string }>(
    `select bucket, object_key, mime, size_bytes, status from media where id = $1 and owner_id = $2`,
    [id, viewer.id],
  );
  if (!m) throw notFound("Upload not found.");
  if (m.status === "ready") return { id, url: `/api/media/${id}` };

  const reject = async (msg: string) => {
    await q(`insert into storage_gc (object_key, bucket, reason) values ($1, $2, 'failed validation') on conflict do nothing`, [m.object_key, m.bucket]);
    await q(`delete from media where id = $1`, [id]);
    throw new ApiError(422, msg, "INVALID_FILE");
  };

  let head;
  try {
    head = await headObject(m.bucket, m.object_key);
  } catch {
    throw new ApiError(409, "The file hasn't finished uploading.", "NOT_UPLOADED");
  }
  if (head.size !== Number(m.size_bytes)) await reject("The uploaded file size doesn't match.");
  if (head.contentType && head.contentType !== m.mime) await reject("The uploaded file type doesn't match.");
  if (!signatureMatches(m.mime, await readHead(m.bucket, m.object_key))) await reject("That file isn't a valid image or video.");

  await q(`update media set status = 'ready' where id = $1`, [id]);
  return { id, url: `/api/media/${id}` };
});
