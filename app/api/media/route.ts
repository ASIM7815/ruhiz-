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
 */

export const runtime = 'nodejs';

const KEY_PATTERN = /^(posts|avatars|chats)\/[A-Za-z0-9_-]+\/\d{4}-\d{2}\/[0-9a-fA-F-]{10,40}\.[A-Za-z0-9]{2,5}$/;
const TTL_SECONDS = 3600;

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

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      // force sane content handling for inline display
      ResponseContentDisposition: 'inline',
    });
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: TTL_SECONDS });

    return NextResponse.json({ success: true, url: signedUrl, expiresIn: TTL_SECONDS });
  } catch (error) {
    console.error('[media] signing error:', error);
    return NextResponse.json({ error: 'Failed to generate media URL' }, { status: 500 });
  }
}
