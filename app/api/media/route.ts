import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME, isR2ServerConfigured } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

/**
 * Presigned GET for private R2 media.
 *
 * - requires an authenticated Supabase session (reading Ruhiz content is for
 *   signed-in members; the underlying post/chat visibility is additionally
 *   enforced by Postgres RLS on the rows referencing these keys)
 * - only object keys following the app's namespaced key format are signable
 * - URLs are temporary (1 hour) and scoped to a single object
 *
 * The signed URL is handed straight to an <img> or <video> element, so the
 * response has to be inline-displayable and carry a media type the browser can
 * actually decode. `response-content-type` is derived from the object key's
 * extension — which the upload route set from a validated MIME allow-list — so
 * playback never depends on whatever Content-Type happened to be stored on the
 * object (older rows and third-party tools have left `application/octet-stream`
 * behind, which makes <video> bail out immediately).
 */

export const runtime = 'nodejs';

const KEY_PATTERN = /^(posts|avatars|chats)\/[A-Za-z0-9_-]+\/\d{4}-\d{2}\/[0-9a-fA-F-]{10,40}\.[A-Za-z0-9]{2,5}$/;
const TTL_SECONDS = 3600;

/** Content type to force on the response, keyed by the extension we mint. */
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

function contentTypeForKey(key: string): string | undefined {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXT[ext];
}

export async function GET(request: NextRequest) {
  try {
    if (!isR2ServerConfigured()) {
      return NextResponse.json({ error: 'Media storage is not configured.' }, { status: 503 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const key = request.nextUrl.searchParams.get('key');
    if (!key) {
      return NextResponse.json({ error: 'No key provided' }, { status: 400 });
    }

    // Reject path traversal and foreign key shapes
    if (key.includes('..') || key.startsWith('/') || !KEY_PATTERN.test(key)) {
      return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
    }

    const responseType = contentTypeForKey(key);
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      // force sane content handling for inline display
      ResponseContentDisposition: 'inline',
      // guarantee a decodable media type for <video>/<img>
      ...(responseType ? { ResponseContentType: responseType } : {}),
    });
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: TTL_SECONDS });

    // Short-lived and per-user: never let a shared/proxy cache serve one
    // member's signed media URL to another.
    return NextResponse.json(
      { success: true, url: signedUrl, expiresIn: TTL_SECONDS },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[media] signing error:', error);
    return NextResponse.json({ error: 'Failed to generate media URL' }, { status: 500 });
  }
}
