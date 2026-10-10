import { NextResponse, type NextRequest } from "next/server";
import { parseId, route, toErrorResponse } from "@/server/http";
import { one, q } from "@/server/db";
import { ApiError, notFound } from "@/server/errors";
import { requireViewer } from "@/server/session";
import { drainStorageQueue, presignGet, storageConfigured } from "@/server/storage";

/**
 * Serves media to signed-in members only: checks access, then redirects to a short-lived
 * presigned URL. Buckets stay private; storage credentials never reach the browser.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer();
    const id = parseId((await ctx.params).id);
    const m = await one<{ bucket: string; object_key: string; kind: string; status: string; owner_id: string; purpose: string; post_id: string | null }>(
      `select bucket, object_key, kind, status, owner_id, purpose, post_id from media where id = $1`,
      [id],
    );
    if (!m) throw notFound();
    const visible = m.owner_id === viewer.id || (m.status === "ready" && (m.purpose === "avatar" || m.post_id !== null));
    if (!visible) throw notFound();
    if (!storageConfigured()) throw new ApiError(503, "Storage is not configured.");
    const ttl = m.kind === "video" ? 3600 : 900;
    const url = await presignGet(m.bucket, m.object_key, ttl);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": `private, max-age=${Math.floor(ttl * 0.8)}` } });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** Owners may discard an upload that isn't attached to a post yet. */
export const DELETE = route<{ id: string }>({}, async ({ viewer, params }) => {
  const id = parseId(params.id);
  const m = await one<{ object_key: string; bucket: string }>(
    `select object_key, bucket from media where id = $1 and owner_id = $2 and post_id is null
        and not exists (select 1 from profiles where avatar_media_id = media.id)`,
    [id, viewer.id],
  );
  if (!m) throw notFound();
  await q(`insert into storage_gc (object_key, bucket, reason) values ($1, $2, 'discarded') on conflict do nothing`, [m.object_key, m.bucket]);
  await q(`delete from media where id = $1`, [id]);
  drainStorageQueue().catch(() => {});
  return { ok: true };
});
