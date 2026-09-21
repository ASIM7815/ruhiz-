import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, isR2ServerConfigured } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

/**
 * Delete an R2 media object. The caller can only delete objects inside their
 * own key namespace ({kind}/{userId}/...): the session user must match the key
 * prefix — never trust the client to police this. Supabase Storage and
 * IndexedDB deletes are enforced by storage RLS / the local device store.
 */

export const runtime = 'nodejs';

const KEY_PATTERN = /^(posts|avatars|chats|covers|proofs)\/[A-Za-z0-9_-]+\/\d{4}-\d{2}\/[0-9a-fA-F-]{10,40}\.[A-Za-z0-9]{2,5}$/;

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

    const keyOwner = key.split('/')[1];
    if (keyOwner !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own files.' }, { status: 403 });
    }

    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    } catch {
      return NextResponse.json({ deleted: false, error: 'File not found.' }, { status: 404 });
    }

    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[upload/delete] error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
