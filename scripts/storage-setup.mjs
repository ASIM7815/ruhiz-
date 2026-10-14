#!/usr/bin/env node
// Verifies the image and video buckets and sets least-privilege CORS rules for browser uploads
// (presigned PUTs, including multipart parts) and playback. Never creates buckets.
//
//   npm run storage:setup                                   origins from APP_ORIGIN (+ http://localhost:3000)
//   npm run storage:setup -- --origin https://example.com   add more origins (repeatable)
//   npm run storage:setup -- --check                        only print the current rules
//
// Presigned URLs carry their own signature, so no cookies/credentials are involved and every
// origin must still be listed explicitly. Never use "*".
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import { GetBucketCorsCommand, HeadBucketCommand, PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand, S3Client } from "@aws-sdk/client-s3";

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
const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const extra = argv.flatMap((a, i) => (a === "--origin" && argv[i + 1] ? [argv[i + 1]] : []));
const origins = [
  ...new Set(
    [...(process.env.APP_ORIGIN ?? "").split(","), ...extra, "http://localhost:3000"]
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
  ),
];
for (const o of origins) {
  if (o === "*" || !/^https?:\/\/[^/*]+$/.test(o)) {
    console.error(`Refusing origin "${o}": list exact origins like https://example.com.`);
    process.exit(1);
  }
}

const s3 = new S3Client({ endpoint, region: process.env.NEON_STORAGE_REGION || "us-east-2", forcePathStyle: true, credentials: { accessKeyId: id, secretAccessKey: secret } });

for (const bucket of [process.env.NEON_STORAGE_IMAGES_BUCKET || "images", process.env.NEON_STORAGE_VIDEO_BUCKET || "videos"]) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (e) {
    console.error(`✗ Bucket "${bucket}" is not reachable (${e.name}). Fix NEON_STORAGE_*_BUCKET or create it in the Neon Console; this script won't create buckets.`);
    process.exitCode = 1;
    continue;
  }
  if (!checkOnly) {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              // PUT = presigned upload / multipart part; GET + HEAD = playback and range requests.
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["content-type", "range"],
              // The browser must read each part's ETag to complete a multipart upload.
              ExposeHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    try {
      // Belt and braces next to the app's own sweep: storage drops unfinished multipart uploads after 2 days.
      await s3.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: bucket,
          LifecycleConfiguration: { Rules: [{ ID: "abort-incomplete-multipart", Status: "Enabled", Filter: { Prefix: "" }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 2 } }] },
        }),
      );
      console.log(`  ${bucket}: lifecycle rule set (abort incomplete multipart uploads after 2 days)`);
    } catch (e) {
      console.log(`  ${bucket}: lifecycle rules not supported by the provider (${e.name}); the app's own sweep still cleans up.`);
    }
  }
  const cors = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
  const r = cors.CORSRules?.[0];
  console.log(`✓ ${bucket}: origins=${r?.AllowedOrigins?.join(", ")} methods=${r?.AllowedMethods?.join(",")} headers=${r?.AllowedHeaders?.join(",")} expose=${r?.ExposeHeaders?.join(",")}`);
}
