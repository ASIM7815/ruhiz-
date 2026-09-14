import { S3Client } from '@aws-sdk/client-s3';

/**
 * Create R2 client (S3-compatible) — server-side only. Credentials are read
 * from server env vars and are NEVER exposed to the browser bundle: every
 * user-facing operation goes through presigned URLs minted in API routes.
 */

export function isR2ServerConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

/**
 * Storage endpoint. Defaults to the Cloudflare R2 S3 API for the account.
 * `R2_ENDPOINT` is an optional override so the same code path can be exercised
 * against any S3-compatible backend (local test harness, staging gateway).
 */
export function r2Endpoint(): string {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT.replace(/\/+$/, '');
  return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint(),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
  // Address the bucket as /<bucket>/<key> instead of <bucket>.<host>/<key>.
  // Only needed for S3-compatible backends without wildcard DNS (test harness).
  forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',

  // ── REQUIRED for Cloudflare R2 ────────────────────────────────────────────
  // Since @aws-sdk/client-s3 v3.729.0 the SDK turns on "default integrity
  // protections" (requestChecksumCalculation / responseChecksumValidation =
  // WHEN_SUPPORTED). That silently folds extra parameters into the canonical
  // request of EVERY presigned URL:
  //
  //   PutObject → x-amz-checksum-crc32=AAAAAA%3D%3D   (CRC32 of an EMPTY body)
  //               x-amz-sdk-checksum-algorithm=CRC32
  //   GetObject → x-amz-checksum-mode=ENABLED
  //
  // R2 does not implement `x-amz-checksum-mode`, so a presigned GET carrying it
  // is answered with an error instead of the object. The media URL therefore
  // never streams, <video> fires onError, and the player falls back to
  // "Video unavailable" even though the upload itself succeeded. The PUT side
  // is just as wrong in principle — the signed CRC32 is computed over an empty
  // body, so it can never describe what the browser later uploads.
  //
  // WHEN_REQUIRED keeps presigned URLs to exactly the parameters Cloudflare
  // documents (X-Amz-Algorithm/Credential/Date/Expires/SignedHeaders/Signature
  // plus the response-content-* overrides we ask for). Server-side calls that
  // genuinely require a checksum still get one.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});
