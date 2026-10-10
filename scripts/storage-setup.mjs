#!/usr/bin/env node
// Verifies the existing `images` and `video` buckets and sets their CORS rules so browsers can
// upload with presigned PUTs. Never creates buckets. Usage: npm run storage:setup
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { GetBucketCorsCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

setDefaultAutoSelectFamilyAttemptTimeout(2500);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(root, f), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  } catch {}
}

const { NEON_STORAGE_ENDPOINT: endpoint, NEON_STORAGE_ACCESS_KEY_ID: id, NEON_STORAGE_SECRET_ACCESS_KEY: secret } = process.env;
if (!endpoint || !id || !secret) {
  console.error("Set NEON_STORAGE_ENDPOINT, NEON_STORAGE_ACCESS_KEY_ID and NEON_STORAGE_SECRET_ACCESS_KEY in .env.local first.");
  process.exit(1);
}
const origins = [...new Set([...(process.env.APP_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean), "http://localhost:3000"])];
const s3 = new S3Client({ endpoint, region: process.env.NEON_STORAGE_REGION || "us-east-2", forcePathStyle: true, credentials: { accessKeyId: id, secretAccessKey: secret } });

for (const bucket of [process.env.NEON_STORAGE_IMAGES_BUCKET || "images", process.env.NEON_STORAGE_VIDEO_BUCKET || "video"]) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (e) {
    console.error(`Bucket "${bucket}" is not reachable (${e.name}). Create it in the Neon Console; this script won't create buckets.`);
    process.exitCode = 1;
    continue;
  }
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["content-type"], ExposeHeaders: ["etag"], MaxAgeSeconds: 3600 }] },
    }),
  );
  const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log(`✓ ${bucket}: CORS allows ${cors.CORSRules?.[0]?.AllowedOrigins?.join(", ")}`);
}
