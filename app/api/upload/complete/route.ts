import { NextRequest, NextResponse } from 'next/server';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, isR2ServerConfigured } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

/**
 * Post-upload verification: confirms the object actually landed in R2 and
 * returns its size/content type so the client can show accurate state and
 * safely persist the key on the post row.
 */

export const runtime = 'nodejs';

const KEY_PATTERN = /^(posts|avatars|chats)\/[A-Za-z0-9_-]+\/\d{4}-\d{2}\/[0-9a-fA-F-]{10,40}\.[A-Za-z0-9]{2,5}$/;

export async function POST(request: NextRequest) {
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

    const body = (await request.json().catch(() => null)) as { key?: string } | null;
    const key = body?.key;
    if (!key || key.includes('..') || !KEY_PATTERN.test(key)) {
      return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
    }

    try {
      const head = await r2Client.send(
        new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
      );
      return NextResponse.json({
        exists: true,
        size: head.ContentLength ?? null,
        contentType: head.ContentType ?? null,
      });
    } catch {
      return NextResponse.json({ exists: false }, { status: 200 });
    }
  } catch (error) {
    console.error('[upload/complete] error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
