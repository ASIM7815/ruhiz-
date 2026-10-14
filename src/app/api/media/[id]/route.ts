import { NextResponse, type NextRequest } from "next/server";
import { parseId, route, toErrorResponse } from "@/server/http";
import { one, q } from "@/server/db";
import { ApiError, notFound } from "@/server/errors";
import { accountRevealed } from "@/server/mappers";
import { requireViewer } from "@/server/session";
import { abortMultipart, drainStorageQueue, presignGet, storageConfigured } from "@/server/storage";

/**
 * Serves media to signed-in members only: checks access, then redirects to a short-lived
 * presigned URL. Buckets stay private; storage credentials never reach the browser.
 *  - post media: any signed-in member (posts are visible to members)
 *  - profile photo / banner: only while the owner's identity is revealed (or to the owner)
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer();
    const id = parseId((await ctx.params).id);
    const m = await one<{ bucket: string; object_key: string; kind: string; status: string; owner_id: string; purpose: string; post_id: string | null; owner_revealed: boolean }>(
      `select m.bucket, m.object_key, m.kind, m.status, m.owner_id, m.purpose, m.post_id, ${accountRevealed("p")} as owner_revealed
         from media m join profiles p on p.user_id = m.owner_id where m.id = $1`,
      [id],
    );
    if (!m) throw notFound();
    const own = m.owner_id === viewer.id;
    const isProfileImage = m.purpose === "avatar" || m.purpose === "banner";
    const visible = own || (m.status === "ready" && (m.post_id !== null || (isProfileImage && m.owner_revealed)));
    if (!visible) throw notFound();
    if (!storageConfigured()) throw new ApiError(503, "Storage is not configured.");
    const ttl = m.kind === "video" ? 3600 : 900;
    const url = await presignGet(m.bucket, m.object_key, ttl);
    // Profile images are re-checked on every load so hiding an identity takes effect immediately.
    const cache = isProfileImage && !own ? "private, no-cache" : `private, max-age=${Math.floor(ttl * 0.8)}`;
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": cache } });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** Owners may discard an upload that isn't attached to a post or profile yet (cancels a multipart upload too). */
export const DELETE = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const m = await one<{ object_key: string; bucket: string; upload_id: string | null }>(
    `select object_key, bucket, upload_id from media where id = $1 and owner_id = $2 and post_id is null
        and not exists (select 1 from profiles where avatar_media_id = media.id or banner_media_id = media.id)`,
    [id, viewer.id],
  );
  if (!m) throw notFound();
  if (m.upload_id) await abortMultipart(m.bucket, m.object_key, m.upload_id).catch(() => {});
  await q(`insert into storage_gc (object_key, bucket, reason) values ($1, $2, 'discarded') on conflict do nothing`, [m.object_key, m.bucket]);
  await q(`delete from media where id = $1`, [id]);
  drainStorageQueue().catch(() => {});
  return { ok: true };
});
