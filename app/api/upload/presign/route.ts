import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { r2Client, R2_BUCKET_NAME, isR2ServerConfigured } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

/**
 * Presigned PUT for direct browser → Cloudflare R2 uploads.
 *
 * Security model:
 *  - caller must hold a valid Supabase session (checked against auth.users)
 *  - mime type + size validated against per-kind allow-lists
 *  - object keys are namespaced by kind + user id + month + uuid, so users
 *    can never overwrite or address each other's objects
 *  - the R2 secret never leaves the server; the browser only ever sees a
 *    short-lived presigned URL scoped to this exact key + content type
 */

export const runtime = 'nodejs';

const KINDS: Record<string, { folder: string; maxMB: number; mimes: string[] }> = {
  'post-image': { folder: 'posts', maxMB: 10, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  'chat-image': { folder: 'chats', maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'] },
  avatar: { folder: 'avatars', maxMB: 5, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  cover: { folder: 'avatars', maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  'challenge-cover': { folder: 'covers', maxMB: 8, mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] },
  'post-video': { folder: 'posts', maxMB: 300, mimes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'] },
} as const;

type Kind = keyof typeof KINDS;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};

function sanitizeExt(filename: string, mime: string): string {
  const fromName = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  const safe = EXT_BY_MIME[mime] ?? (fromName || '').replace(/[^a-z0-9]/g, '').slice(0, 5);
  return safe || 'bin';
}

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

    const body = (await request.json().catch(() => null)) as
      | { kind?: string; filename?: string; contentType?: string; size?: number }
      | null;
    if (!body?.kind || !(body.kind in KINDS)) {
      return NextResponse.json({ error: 'Invalid upload kind.' }, { status: 400 });
    }
    const kind = body.kind as Kind;
    const cfg = KINDS[kind];

    const contentType = (body.contentType || '').toLowerCase();
    if (!cfg.mimes.includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
    }
    const size = Number(body.size ?? 0);
    if (!Number.isFinite(size) || size <= 0 || size > cfg.maxMB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large — maximum ${cfg.maxMB} MB.` }, { status: 413 });
    }

    // Unique, user-scoped key: kind/userId/yyyy-mm/uuid.ext
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const ext = sanitizeExt(body.filename || '', contentType);
    const key = `${cfg.folder}/${user.id}/${month}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType, // signed: the browser must PUT with this exact type
    });
    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 900,
      // Bind the signature to Content-Type as well as Host, so the presigned URL
      // really is scoped to "this key, this media type" — without it the SDK
      // signs only `host` and a holder of the URL could store any Content-Type
      // they liked at that key (which is how unplayable MIME types end up on
      // otherwise valid objects). Matches the X-Amz-SignedHeaders=content-type;host
      // form Cloudflare documents for R2.
      //
      // The caller MUST send exactly this header value, so `contentType` is
      // echoed back below (it is lowercased here; File.type is not guaranteed
      // to be) and lib/upload.ts uses that returned string rather than its own.
      signableHeaders: new Set(['content-type']),
    });

    return NextResponse.json({ key, uploadUrl, contentType, expiresIn: 900 });
  } catch (error) {
    console.error('[upload/presign] error:', error);
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 });
  }
}
