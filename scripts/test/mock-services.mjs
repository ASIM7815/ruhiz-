/**
 * Local stand-ins used by the end-to-end video test:
 *
 *  1. an R2-faithful S3 endpoint that REALLY verifies SigV4 presigned URLs and
 *     reproduces Cloudflare R2's documented reaction to the AWS SDK's default
 *     integrity-protection parameters, and
 *  2. a minimal Supabase Auth endpoint so the app's real API routes can
 *     authenticate a session.
 *
 * The sandbox has no outbound access to *.r2.cloudflarestorage.com, so this is
 * how the production code path (lib/r2/client.ts + the three API routes) gets
 * exercised for real rather than by inspection.
 */
import http from 'node:http';
import crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/* SigV4 presigned-URL verification (query-string authentication)      */
/* ------------------------------------------------------------------ */

const rfc3986 = (s) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Byte/codepoint ordering — SigV4 sorting is NOT locale-aware. */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function signingKey(secret, dateStamp, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, dateStamp), region), service), 'aws4_request');
}

function signatureFor({ method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash, amzDate, scope, secret }) {
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const [dateStamp, region, service] = scope.split('/');
  const expected = crypto
    .createHmac('sha256', signingKey(secret, dateStamp, region, service))
    .update(stringToSign)
    .digest('hex');
  return { expected, canonicalRequest, stringToSign };
}

/**
 * Verify a request signed with an Authorization header (a direct SDK call such
 * as the HeadObject that /api/upload/complete performs).
 */
export function verifyHeaderSigned({ method, rawPath, query, headers, body, secretAccessKey }) {
  const auth = headers.authorization || '';
  const m = /^AWS4-HMAC-SHA256\s+Credential=([^/]+)\/(\d{8}\/[^/]+\/[^/]+\/aws4_request),\s*SignedHeaders=([^,]+),\s*Signature=([0-9a-f]+)$/i.exec(
    auth.replace(/\s+/g, ' ').trim()
  );
  if (!m) return { ok: false, reason: 'missing or malformed Authorization header' };
  const [, accessKeyId, scope, signedHeaderList, given] = m;

  const amzDate = headers['x-amz-date'];
  if (!amzDate) return { ok: false, reason: 'missing x-amz-date' };

  const signedHeaders = signedHeaderList.split(';').filter(Boolean).sort();
  const canonicalHeaders = signedHeaders
    .map((name) => `${name}:${String(headers[name] ?? '').trim().replace(/\s+/g, ' ')}\n`)
    .join('');

  const pairs = [...query.entries()]
    .map(([k, v]) => [rfc3986(k), rfc3986(v)])
    .sort((a, b) => (a[0] === b[0] ? cmp(a[1], b[1]) : cmp(a[0], b[0])));
  const canonicalQueryString = pairs.map(([k, v]) => `${k}=${v}`).join('&');

  // S3 sends the payload hash in x-amz-content-sha256; honour it literally.
  const declared = headers['x-amz-content-sha256'] || sha256hex(body ?? Buffer.alloc(0));
  const payloadHash = declared === 'STREAMING-UNSIGNED-PAYLOAD-TRAILER' ? 'UNSIGNED-PAYLOAD' : declared;

  const { expected } = signatureFor({
    method,
    canonicalUri: rawPath || '/',
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
    amzDate,
    scope,
    secret: secretAccessKey,
  });

  if (expected !== given.toLowerCase()) {
    return { ok: false, reason: 'SignatureDoesNotMatch', expected, given };
  }
  return { ok: true, accessKeyId };
}

/**
 * Recompute the signature of a presigned request exactly the way AWS/R2 do and
 * compare it with X-Amz-Signature. Returns { ok } or { ok:false, reason }.
 */
export function verifyPresigned({ method, rawPath, query, headers, secretAccessKey }) {
  const given = query.get('X-Amz-Signature');
  if (!given) return { ok: false, reason: 'missing X-Amz-Signature' };

  const algorithm = query.get('X-Amz-Algorithm');
  if (algorithm !== 'AWS4-HMAC-SHA256') return { ok: false, reason: `unsupported algorithm ${algorithm}` };

  const amzDate = query.get('X-Amz-Date');
  const credential = query.get('X-Amz-Credential') || '';
  const [accessKeyId, dateStamp, region, service, terminator] = credential.split('/');
  if (!accessKeyId || !dateStamp || !region || !service || terminator !== 'aws4_request') {
    return { ok: false, reason: 'malformed X-Amz-Credential' };
  }

  // Expiry is enforced by the service, honour it here too.
  const expires = Number(query.get('X-Amz-Expires') || 0);
  const signedAt = Date.parse(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
  if (Number.isFinite(signedAt) && expires && Date.now() > signedAt + expires * 1000) {
    return { ok: false, reason: 'presigned URL expired' };
  }

  // Canonical query string: every param except the signature, sorted by
  // *codepoint* (NOT locale — 'X-Amz-*' must precede 'response-*' and 'x-id'),
  // then URI-encoded.
  const pairs = [...query.entries()]
    .filter(([k]) => k !== 'X-Amz-Signature')
    .map(([k, v]) => [rfc3986(k), rfc3986(v)])
    .sort((a, b) => (a[0] === b[0] ? cmp(a[1], b[1]) : cmp(a[0], b[0])));
  const canonicalQueryString = pairs.map(([k, v]) => `${k}=${v}`).join('&');

  const signedHeaders = (query.get('X-Amz-SignedHeaders') || 'host').split(';').filter(Boolean).sort();
  const canonicalHeaders =
    signedHeaders
      .map((name) => {
        const value = name === 'host' ? headers.host : headers[name];
        return `${name}:${String(value ?? '').trim()}\n`;
      })
      .join('');

  // Presigned requests always sign the literal UNSIGNED-PAYLOAD.
  const payloadHash = query.get('X-Amz-Content-Sha256') || 'UNSIGNED-PAYLOAD';

  const { expected } = signatureFor({
    method,
    canonicalUri: rawPath || '/',
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
    amzDate,
    scope: `${dateStamp}/${region}/${service}/aws4_request`,
    secret: secretAccessKey,
  });

  if (expected !== given.toLowerCase()) {
    return { ok: false, reason: 'SignatureDoesNotMatch', expected, given };
  }
  return { ok: true, accessKeyId };
}

/* ------------------------------------------------------------------ */
/* In-memory object store                                              */
/* ------------------------------------------------------------------ */

const xmlError = (code, message, status) =>
  `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`;

/**
 * @param {object} opts
 * @param {string} opts.accessKeyId      credential the mock will accept
 * @param {string} opts.secretAccessKey  secret used to verify signatures
 * @param {string} opts.bucket           bucket name (path-style)
 * @param {boolean} [opts.rejectChecksumMode=true]
 *        Reproduce Cloudflare R2's documented behaviour: a GET whose presigned
 *        query carries `x-amz-checksum-mode` is answered
 *        "NotImplemented / Header 'x-amz-checksum-mode' ... not implemented"
 *        instead of streaming the object. Set false to model an S3 that ignores
 *        the parameter (real AWS S3 does).
 * @param {boolean} [opts.rejectPutChecksum=false]
 *        Model pre-Feb-2025 R2, which validated the query-string CRC32 against
 *        the real body and answered 400 BadDigest. Current R2 ignores it, which
 *        is why uploads "succeed" while playback fails.
 */
export function createMockS3(opts) {
  const {
    accessKeyId,
    secretAccessKey,
    bucket,
    rejectChecksumMode = true,
    rejectPutChecksum = false,
  } = opts;

  /** @type {Map<string, {body: Buffer, contentType: string, disposition?: string}>} */
  const objects = new Map();
  const audit = [];

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const rawPath = req.url.split('?')[0];
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);

    const send = (status, payload, headers = {}) => {
      res.writeHead(status, { 'Content-Length': Buffer.byteLength(payload), ...headers });
      res.end(payload);
    };

    // ---- verify the signature exactly as the service would ----
    // Presigned (query-string) auth for browser traffic; header auth for the
    // server's own direct SDK calls (e.g. HeadObject in /api/upload/complete).
    const v = u.searchParams.has('X-Amz-Signature')
      ? verifyPresigned({
          method: req.method,
          rawPath,
          query: u.searchParams,
          headers: req.headers,
          secretAccessKey,
        })
      : verifyHeaderSigned({
          method: req.method,
          rawPath,
          query: u.searchParams,
          headers: req.headers,
          body,
          secretAccessKey,
        });
    if (!v.ok) {
      audit.push({ method: req.method, path: rawPath, status: 403, note: v.reason, expected: v.expected, given: v.given });
      if (v.reason === 'SignatureDoesNotMatch') {
        return send(403, xmlError('SignatureDoesNotMatch', 'The request signature we calculated does not match the signature you provided.', 403), { 'Content-Type': 'application/xml' });
      }
      return send(403, xmlError('AccessDenied', v.reason, 403), { 'Content-Type': 'application/xml' });
    }
    if (v.accessKeyId !== accessKeyId) {
      audit.push({ method: req.method, path: rawPath, status: 403, note: 'wrong access key' });
      return send(403, xmlError('AccessDenied', 'Invalid access key', 403), { 'Content-Type': 'application/xml' });
    }

    // ---- path-style: /<bucket>/<key> ----
    const segments = decodeURIComponent(rawPath).split('/').filter(Boolean);
    if (segments[0] !== bucket) {
      audit.push({ method: req.method, path: rawPath, status: 404, note: 'wrong bucket' });
      return send(404, xmlError('NoSuchBucket', `bucket ${segments[0]} != ${bucket}`, 404), { 'Content-Type': 'application/xml' });
    }
    const key = segments.slice(1).join('/');
    const qp = Object.fromEntries([...u.searchParams.entries()].map(([k, val]) => [k.toLowerCase(), val]));

    /* ---------------- Cloudflare R2 compatibility gates ---------------- */
    if (req.method === 'GET' && rejectChecksumMode && 'x-amz-checksum-mode' in qp) {
      audit.push({ method: 'GET', key, status: 501, note: 'x-amz-checksum-mode not implemented' });
      return send(
        501,
        xmlError('NotImplemented', "Header 'x-amz-checksum-mode' with value 'ENABLED' not implemented", 501),
        { 'Content-Type': 'application/xml' }
      );
    }
    if (req.method === 'PUT' && rejectPutChecksum && qp['x-amz-checksum-crc32']) {
      // CRC32 of the EMPTY body is what the SDK signs into a presigned URL.
      const expected = Buffer.from(qp['x-amz-checksum-crc32'], 'base64');
      const actual = crc32(body);
      if (!expected.equals(actual)) {
        audit.push({ method: 'PUT', key, status: 400, note: 'BadDigest (query-string CRC32 vs body)' });
        return send(400, xmlError('BadDigest', 'The CRC32 you specified did not match the calculated checksum.', 400), { 'Content-Type': 'application/xml' });
      }
    }

    /* --------------------------------- PUT -------------------------------- */
    if (req.method === 'PUT') {
      if (!body.length) {
        audit.push({ method: 'PUT', key, status: 400, note: 'empty body' });
        return send(400, xmlError('IncompleteBody', 'empty body', 400), { 'Content-Type': 'application/xml' });
      }
      objects.set(key, { body, contentType: req.headers['content-type'] || 'application/octet-stream' });
      audit.push({ method: 'PUT', key, status: 200, contentType: req.headers['content-type'], size: body.length });
      const etag = `"${crypto.createHash('md5').update(body).digest('hex')}"`;
      res.writeHead(200, { ETag: etag, 'Content-Length': 0 });
      return res.end();
    }

    /* -------------------------------- HEAD -------------------------------- */
    if (req.method === 'HEAD') {
      const obj = objects.get(key);
      if (!obj) {
        audit.push({ method: 'HEAD', key, status: 404 });
        res.writeHead(404, { 'Content-Length': 0 });
        return res.end();
      }
      audit.push({ method: 'HEAD', key, status: 200 });
      res.writeHead(200, {
        'Content-Type': obj.contentType,
        'Content-Length': obj.body.length,
        'Accept-Ranges': 'bytes',
      });
      return res.end();
    }

    /* --------------------------------- GET -------------------------------- */
    if (req.method === 'GET') {
      const obj = objects.get(key);
      if (!obj) {
        audit.push({ method: 'GET', key, status: 404, note: 'NoSuchKey' });
        return send(404, xmlError('NoSuchKey', 'The specified key does not exist.', 404), { 'Content-Type': 'application/xml' });
      }

      // response-content-* overrides honoured by S3/R2 on presigned GETs
      const contentType = qp['response-content-type'] || obj.contentType;
      const disposition = qp['response-content-disposition'] || undefined;

      const base = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        ETag: `"${crypto.createHash('md5').update(obj.body).digest('hex')}"`,
        ...(disposition ? { 'Content-Disposition': disposition } : {}),
      };

      // HTML5 <video> issues byte-range requests; serve them properly.
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!m) {
          audit.push({ method: 'GET', key, status: 416, note: 'bad range' });
          return send(416, xmlError('InvalidArgument', 'bad range', 416), { 'Content-Type': 'application/xml' });
        }
        const total = obj.body.length;
        const start = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2]));
        const end = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
        if (start >= total || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${total}` });
          audit.push({ method: 'GET', key, status: 416 });
          return res.end();
        }
        const slice = obj.body.subarray(start, end + 1);
        audit.push({ method: 'GET', key, status: 206, range, contentType });
        res.writeHead(206, {
          ...base,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': slice.length,
        });
        return res.end(slice);
      }

      audit.push({ method: 'GET', key, status: 200, contentType });
      res.writeHead(200, { ...base, 'Content-Length': obj.body.length });
      return res.end(obj.body);
    }

    audit.push({ method: req.method, key, status: 405 });
    return send(405, xmlError('MethodNotAllowed', req.method, 405), { 'Content-Type': 'application/xml' });
  });

  return {
    server,
    objects,
    audit,
    /** what actually landed in the bucket, for assertions */
    inspect: (key) => objects.get(key),
  };
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  const out = Buffer.alloc(4);
  out.writeUInt32BE((crc ^ -1) >>> 0, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* Minimal Supabase Auth mock                                          */
/* ------------------------------------------------------------------ */

export function createMockSupabase({ users, anonKey }) {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') : {};

    const json = (status, payload) => {
      const s = JSON.stringify(payload);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) });
      res.end(s);
    };

    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      const user = users.find((x) => x.email === body.email && x.password === body.password);
      if (!user) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      return json(200, sessionFor(user));
    }

    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') {
      const user = users.find((x) => x.refresh === body.refresh_token) ?? users[0];
      return json(200, sessionFor(user));
    }

    // GET /auth/v1/user — what supabase.auth.getUser() calls server-side
    if (u.pathname === '/auth/v1/user' && req.method === 'GET') {
      const auth = req.headers.authorization || '';
      const token = auth.replace(/^Bearer\s+/i, '');
      const user = users.find((x) => x.access === token);
      if (!user) return json(401, { msg: 'invalid JWT' });
      return json(200, publicUser(user));
    }

    if (u.pathname === '/auth/v1/settings') return json(200, { external: { email: true }, disable_signup: false });

    // Anything else (PostgREST etc.) — empty result so callers degrade quietly.
    if (u.pathname.startsWith('/rest/v1/')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' });
      return res.end('[]');
    }

    return json(404, { error: 'not_found', path: u.pathname });
  });

  const publicUser = (u) => ({
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at ?? new Date().toISOString(),
    phone: '',
    confirmed_at: u.email_confirmed_at ?? new Date().toISOString(),
    created_at: u.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: u.user_metadata ?? {},
    identities: [],
  });

  const sessionFor = (u) => ({
    access_token: u.access,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: u.refresh,
    user: publicUser(u),
  });

  return { server, anonKey };
}

export function listen(server, port = 0) {
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server.address().port));
  });
}
