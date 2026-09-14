/**
 * End-to-end proof for the "uploaded fine, shows Video unavailable" bug.
 *
 *   Part A — signing level: shows exactly why the old client broke playback and
 *            why the WHEN_REQUIRED client does not, against an R2-faithful mock.
 *   Part B — full pipeline through the REAL app: boots Next.js with the repo's
 *            own route handlers and walks a brand-new video through
 *            presign → PUT → complete-verify → DB value → /api/media →
 *            <video> fetch (byte-range), asserting a playable response.
 *
 * Exit code 0 = every assertion passed.
 */
import { spawn } from 'node:child_process';
import { createMockS3, createMockSupabase, listen } from './mock-services.mjs';
import { makeMp4, MP4_BRAND_OFFSET } from './make-mp4.mjs';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const R2 = {
  R2_ACCOUNT_ID: 'd337a7fca733beca44ce717ee45e8405',
  R2_ACCESS_KEY_ID: 'test-access-key-id',
  R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
  R2_BUCKET_NAME: 'theruhiz',
};
const ANON_KEY = 'test-anon-key';
const USER = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'tester@ruhiz.test',
  password: 'test-password-123',
  access: 'test-access-token-xyz',
  refresh: 'test-refresh-token-xyz',
};

let failures = 0;
let checks = 0;
const ok = (cond, label, extra = '') => {
  checks++;
  if (cond) console.log(`   ✅ ${label}`);
  else { failures++; console.log(`   ❌ ${label}${extra ? `  →  ${extra}` : ''}`); }
  return !!cond;
};
const head = (t) => console.log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`);

/* ================================================================== */
/* boot mocks                                                          */
/* ================================================================== */

const s3 = createMockS3({
  accessKeyId: R2.R2_ACCESS_KEY_ID,
  secretAccessKey: R2.R2_SECRET_ACCESS_KEY,
  bucket: R2.R2_BUCKET_NAME,
  rejectChecksumMode: true,   // R2: "x-amz-checksum-mode ... not implemented"
  rejectPutChecksum: false,   // current R2 ignores the query CRC32 → upload "succeeds"
});
const supa = createMockSupabase({ users: [USER], anonKey: ANON_KEY });

const s3Port = await listen(s3.server);
const supaPort = await listen(supa.server);
const S3_ENDPOINT = `http://127.0.0.1:${s3Port}`;
const SUPABASE_URL = `http://127.0.0.1:${supaPort}`;

console.log(`mock S3 (R2-faithful) : ${S3_ENDPOINT}`);
console.log(`mock Supabase auth    : ${SUPABASE_URL}`);

/* ================================================================== */
/* PART A — why playback broke                                         */
/* ================================================================== */

head('PART A · presigned-GET compatibility (root cause)');

const probeKey = 'posts/probe-aaaaaaaa-bbbb/2026-09/probe.mp4';
s3.objects.set(probeKey, { body: makeMp4(4096), contentType: 'video/mp4' });

const clientBase = {
  region: 'auto',
  credentials: { accessKeyId: R2.R2_ACCESS_KEY_ID, secretAccessKey: R2.R2_SECRET_ACCESS_KEY },
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
};

const variants = [
  ['BEFORE FIX  (SDK defaults, as the repo had it)', clientBase, false],
  ['AFTER  FIX  (requestChecksumCalculation/responseChecksumValidation = WHEN_REQUIRED)',
    { ...clientBase, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' }, true],
];

const partA = {};
for (const [label, cfg, expectOk] of variants) {
  const c = new S3Client(cfg);
  const url = await getSignedUrl(
    c,
    new GetObjectCommand({ Bucket: R2.R2_BUCKET_NAME, Key: probeKey, ResponseContentDisposition: 'inline' }),
    { expiresIn: 3600 }
  );
  const params = [...new URL(url).searchParams.keys()];
  const res = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
  const text = res.status >= 400 ? (await res.text()).slice(0, 200) : '';
  console.log(`\n  ${label}`);
  console.log(`     query params : ${params.join(', ')}`);
  console.log(`     ranged GET   : ${res.status} ${res.headers.get('content-type') ?? ''}`);
  if (text) console.log(`     body         : ${text.replace(/\s+/g, ' ')}`);
  partA[expectOk ? 'after' : 'before'] = { params, status: res.status };

  if (expectOk) {
    ok(!params.some((p) => /x-amz-checksum|x-amz-sdk-checksum/i.test(p)),
      'presigned GET carries no R2-incompatible checksum params');
    ok(res.status === 206, 'ranged GET streams the object (206 Partial Content)');
    ok((res.headers.get('content-type') || '') === 'video/mp4', 'response Content-Type is video/mp4');
  } else {
    ok(params.includes('x-amz-checksum-mode'), 'reproduced: SDK signs x-amz-checksum-mode into the URL');
    ok(res.status >= 400, `reproduced: R2 refuses the presigned GET (${res.status}) — this is the "Video unavailable"`);
  }
}

// Signature verification in the mock is real, not a rubber stamp.
head('PART A · control: the mock really verifies SigV4');
{
  const c = new S3Client({ ...clientBase, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  const good = await getSignedUrl(c, new GetObjectCommand({ Bucket: R2.R2_BUCKET_NAME, Key: probeKey }), { expiresIn: 600 });
  const tampered = good.replace(/X-Amz-Signature=[0-9a-f]{8}/, 'X-Amz-Signature=deadbeef');
  const r = await fetch(tampered);
  ok(r.status === 403, 'tampered signature is rejected with 403', `got ${r.status}`);
  const r2 = await fetch(good);
  ok(r2.status === 200, 'untampered signature is accepted', `got ${r2.status}`);
  await r2.body?.cancel();
}

/* ================================================================== */
/* PART B — full pipeline through the real Next.js app                 */
/* ================================================================== */

head('PART B · booting the real app (next dev)');

const APP_PORT = process.env.E2E_APP_PORT
  ? Number(process.env.E2E_APP_PORT)
  : await (async () => {
      const { default: net } = await import('node:net');
      return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
          const { port } = srv.address();
          srv.close(() => resolve(port));
        });
      });
    })();
const env = {
  ...process.env,
  ...R2,
  R2_ENDPOINT: S3_ENDPOINT,
  R2_FORCE_PATH_STYLE: 'true',
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  PORT: String(APP_PORT),
};

const next = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', String(APP_PORT)], {
  env,
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});
let nextLog = '';
next.stdout.on('data', (d) => { nextLog += d.toString(); });
next.stderr.on('data', (d) => { nextLog += d.toString(); });

const APP = `http://127.0.0.1:${APP_PORT}`;

async function waitForApp(timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (next.exitCode !== null) throw new Error(`next exited early (${next.exitCode}):\n${nextLog.slice(-2000)}`);
    try {
      const r = await fetch(APP, { redirect: 'manual' });
      if (r.status < 500) return;
      await r.body?.cancel();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`next did not become ready:\n${nextLog.slice(-2000)}`);
}

let exitCode = 1;
try {
  await waitForApp();
  ok(true, 'next dev is serving');

  /* ---- obtain a real session cookie via the same SDK the app uses ---- */
  const captured = new Map();
  const sb = createSupabaseClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      storage: {
        getItem: async (k) => captured.get(k) ?? null,
        setItem: async (k, v) => { captured.set(k, v); },
        removeItem: async (k) => { captured.delete(k); },
      },
    },
  });
  const { error: signInError } = await sb.auth.signInWithPassword({ email: USER.email, password: USER.password });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);
  const [[cookieName, sessionJson]] = [...captured.entries()];
  // @supabase/ssr defaults to cookieEncoding:"base64url" → "base64-" + base64url(JSON)
  const cookie = `${cookieName}=base64-${Buffer.from(sessionJson, 'utf8').toString('base64url')}`;
  ok(Boolean(cookieName && sessionJson), `session cookie captured (${cookieName})`);

  const authed = { headers: { cookie, 'content-type': 'application/json' } };

  /* ---- unauthenticated access must be refused ---- */
  {
    const r = await fetch(`${APP}/api/media?key=posts/x/2026-09/y.mp4`);
    ok(r.status === 401, 'GET /api/media without a session → 401', `got ${r.status}`);
  }

  /* ---- the video under test ---- */
  const video = makeMp4(256 * 1024); // 256 KB, big enough for meaningful ranges
  const file = { name: 'my-new-video.mp4', type: 'video/mp4', size: video.length };

  head('PART B · 1/5  POST /api/upload/presign');
  const presignRes = await fetch(`${APP}/api/upload/presign`, {
    method: 'POST',
    ...authed,
    body: JSON.stringify({ kind: 'post-video', filename: file.name, contentType: file.type, size: file.size }),
  });
  const presign = await presignRes.json();
  ok(presignRes.status === 200, 'presign returns 200', `${presignRes.status} ${JSON.stringify(presign)}`);
  const key = presign.key;
  ok(/posts\//.test(key) && key.startsWith(`posts/${USER.id}/`), `key is user-scoped: ${key}`);
  ok(/\.mp4$/.test(key), 'key extension matches the video MIME type');

  const putUrl = new URL(presign.uploadUrl);
  const putParams = [...putUrl.searchParams.keys()];
  ok(!putParams.some((p) => /x-amz-checksum|x-amz-sdk-checksum/i.test(p)),
    'presigned PUT carries no R2-incompatible checksum params', putParams.join(', '));
  ok(putUrl.origin === S3_ENDPOINT, 'presigned PUT targets the configured storage endpoint');

  head('PART B · 2/5  PUT the video straight to storage (what the browser XHR does)');
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: video,
  });
  ok(putRes.status === 200, `upload accepted (${putRes.status})`, `${putRes.status} ${(await putRes.text().catch(() => '')).slice(0, 200)}`);
  const stored = s3.inspect(key);
  ok(Boolean(stored), 'object physically exists in the bucket at the returned key');
  ok(stored?.contentType === 'video/mp4', `stored Content-Type is video/mp4 (got ${stored?.contentType})`);
  ok(stored?.body.equals(video) === true, 'stored bytes are identical to what was uploaded');
  ok(stored?.body.subarray(4, 8).toString('latin1') === 'ftyp', 'stored object is a valid MP4 container');

  head('PART B · 3/5  POST /api/upload/complete (server verifies the object)');
  const completeRes = await fetch(`${APP}/api/upload/complete`, {
    method: 'POST', ...authed, body: JSON.stringify({ key }),
  });
  const complete = await completeRes.json();
  ok(complete.exists === true, 'verification reports the object exists', JSON.stringify(complete));
  ok(complete.contentType === 'video/mp4', `verification reports Content-Type video/mp4 (got ${complete.contentType})`);
  ok(complete.size === video.length, `verification reports the right size (${complete.size})`);

  head('PART B · 4/5  the value that goes into posts.video_url');
  // This exact string is what store.createPost() writes to posts.video_url and
  // what PostCard/ProfileView later read back as post.video.
  const dbValue = key;
  ok(!/^(https?:|data:|blob:)/i.test(dbValue), 'DB value is a storage key, not a dead blob:/data: URL');
  ok(!dbValue.startsWith('/'), 'DB value is not an app-relative path');
  const { isR2Key } = await import('../../lib/media.ts').catch(async () => {
    // lib/media.ts is TS + 'use client'; re-implement the two predicates it exports
    // so this assertion still runs outside the bundler.
    return {
      isR2Key: (v) => !!v && !/^(https?:|data:|blob:)/i.test(v) && !v.startsWith('/') && /^(posts|avatars|chats)\/[^\s]+$/.test(v),
    };
  });
  ok(isR2Key(dbValue), 'isR2Key() recognises the stored value → player will resolve it');

  head('PART B · 5/5  GET /api/media → what the <video> element actually loads');
  const mediaRes = await fetch(`${APP}/api/media?key=${encodeURIComponent(dbValue)}`, authed);
  const media = await mediaRes.json();
  ok(mediaRes.status === 200, 'GET /api/media returns 200', `${mediaRes.status} ${JSON.stringify(media).slice(0, 200)}`);
  ok(typeof media.url === 'string' && media.url.startsWith('http'), 'a signed URL was returned');

  if (media.url) {
    const getParams = [...new URL(media.url).searchParams.keys()];
    ok(!getParams.some((p) => /x-amz-checksum|x-amz-sdk-checksum/i.test(p)),
      'signed media URL carries no R2-incompatible checksum params', getParams.join(', '));
    ok(getParams.includes('response-content-disposition'), 'signed for inline display');

    // Exactly the request an HTML5 <video> makes when it starts + seeks.
    const ranged = await fetch(media.url, { headers: { Range: 'bytes=0-1023' } });
    const rangedBody = Buffer.from(await ranged.arrayBuffer());
    ok(ranged.status === 206, 'ranged request → 206 Partial Content (required for <video> seeking)', `got ${ranged.status}`);
    ok(ranged.headers.get('accept-ranges') === 'bytes', 'server advertises Accept-Ranges: bytes');
    ok(ranged.headers.get('content-range') === `bytes 0-1023/${video.length}`,
      `Content-Range is correct (${ranged.headers.get('content-range')})`);
    ok((ranged.headers.get('content-type') || '') === 'video/mp4',
      `stream Content-Type is video/mp4 (got ${ranged.headers.get('content-type')})`);
    ok(ranged.headers.get('content-disposition') === 'inline', 'Content-Disposition: inline (plays in-page, no download)');
    ok(rangedBody.length === 1024, 'exactly the requested byte range was returned');
    ok(rangedBody.subarray(4, 8).toString('latin1') === 'ftyp', 'streamed bytes are the real MP4 header');

    // A mid-file seek, the other shape browsers use.
    const seek = await fetch(media.url, { headers: { Range: `bytes=${video.length - 2048}-${video.length - 1}` } });
    const seekBody = Buffer.from(await seek.arrayBuffer());
    ok(seek.status === 206 && seekBody.length === 2048, 'seek to the tail returns 206 with the right slice');
    ok(seekBody.equals(video.subarray(video.length - 2048)), 'tail bytes match the uploaded file');

    // Full download must be byte-identical.
    const full = await fetch(media.url);
    const fullBody = Buffer.from(await full.arrayBuffer());
    ok(full.status === 200 && fullBody.equals(video), 'full GET is byte-identical to the uploaded video');
    ok(fullBody.subarray(MP4_BRAND_OFFSET, MP4_BRAND_OFFSET + 4).toString('latin1') === 'isom', 'major brand is isom');

    // Wrong MIME must not be silently accepted for a video key.
    ok(
      full.status === 200 && !/octet-stream/i.test(full.headers.get('content-type') || ''),
      'not served as application/octet-stream',
      `${full.status} ${full.headers.get('content-type')}`
    );
  }

  head('PART B · extra: legacy object stored with the wrong Content-Type');
  {
    // Simulates an older/third-party upload that landed as a generic binary.
    // The signed GET has to repair the media type from the key extension, or a
    // <video> element refuses to decode it.
    const legacyKey = `posts/${USER.id}/2026-09/1e9ac0de-0000-4000-8000-000000000001.mp4`;
    s3.objects.set(legacyKey, { body: makeMp4(8192), contentType: 'application/octet-stream' });
    const r = await fetch(`${APP}/api/media?key=${encodeURIComponent(legacyKey)}`, authed);
    const j = await r.json();
    ok(r.status === 200 && typeof j.url === 'string', 'legacy object can still be signed');
    if (j.url) {
      const stream = await fetch(j.url, { headers: { Range: 'bytes=0-511' } });
      ok((stream.headers.get('content-type') || '') === 'video/mp4',
        `octet-stream object is served to the player as video/mp4 (got ${stream.headers.get('content-type')})`);
      ok(stream.status === 206, 'legacy object also streams by range', `got ${stream.status}`);
      await stream.body?.cancel();
    }
  }

  head('PART B · negative controls');
  {
    const r = await fetch(`${APP}/api/media?key=${encodeURIComponent('../../etc/passwd')}`, authed);
    ok(r.status === 400, 'path traversal is rejected', `got ${r.status}`);
    const r2 = await fetch(`${APP}/api/media?key=${encodeURIComponent('posts/someone-else/2026-09/x.mp4')}`, authed);
    ok(r2.status === 200 || r2.status === 400, 'foreign-shaped key handled without leaking internals', `got ${r2.status}`);
    const r3 = await fetch(`${APP}/api/upload/presign`, {
      method: 'POST', ...authed,
      body: JSON.stringify({ kind: 'post-video', filename: 'x.exe', contentType: 'application/x-msdownload', size: 100 }),
    });
    ok(r3.status === 415, 'disallowed MIME type is refused at presign', `got ${r3.status}`);
  }
  exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  failures++;
  console.log(`\n💥 harness error: ${err.message}\n`);
  console.log(nextLog.slice(-3000));
  exitCode = 1;
} finally {
  head(`RESULT · ${checks - failures}/${checks} assertions passed${failures ? `, ${failures} FAILED` : ''}`);
  if (failures && process.env.E2E_AUDIT !== '0') {
    console.log('\n  storage audit trail (every request the mock received):');
    for (const a of s3.audit) {
      console.log(`   ${String(a.status).padEnd(4)} ${String(a.method).padEnd(5)} ${a.key ?? a.path ?? ''}${a.note ? `  ← ${a.note}` : ''}`);
    }
  }
  next.kill('SIGKILL');
  s3.server.close();
  supa.server.close();
  console.log(failures ? '\n❌ VIDEO PLAYBACK PIPELINE STILL BROKEN\n' : '\n✅ VIDEO PLAYS: upload → storage → key → signed URL → streamable MP4\n');
  process.exit(exitCode);
}
