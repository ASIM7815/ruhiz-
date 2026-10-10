import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { q } from "./db";
import { env } from "./env";
import { ApiError, badRequest } from "./errors";
import { requireAdmin, requireViewer, type Viewer } from "./session";

type Access = "user" | "admin";

interface Ctx<P> {
  req: NextRequest;
  viewer: Viewer;
  params: P;
}

interface Options {
  access?: Access;
  /** e.g. { key: "post", limit: 20, windowSec: 3600 } — per-user fixed-window limit. */
  rateLimit?: { key: string; limit: number; windowSec: number };
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** CSRF defence: state-changing requests must come from our own origin. */
function checkOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new ApiError(403, "Cross-site request blocked.", "CSRF");
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError(403, "Missing request origin.", "CSRF");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Invalid request origin.", "CSRF");
  }
  const allowed = originHost === host || env.allowedOrigins.some((o) => o === origin.replace(/\/$/, ""));
  if (!allowed) throw new ApiError(403, "Cross-site request blocked.", "CSRF");
}

export async function rateLimit(userId: string, key: string, limit: number, windowSec: number) {
  const rows = await q<{ count: number }>(
    `insert into rate_limits (bucket_key, window_start, count)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     on conflict (bucket_key, window_start) do update set count = rate_limits.count + 1
     returning count`,
    [`${key}:${userId}`, windowSec],
  );
  if (Math.random() < 0.01) q(`delete from rate_limits where window_start < now() - interval '2 days'`).catch(() => {});
  if ((rows[0]?.count ?? 0) > limit) throw new ApiError(429, "You're doing that too often. Please wait a little and try again.", "RATE_LIMITED");
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Wraps a route handler with authentication, authorization, CSRF and error handling. */
export function route<P = Record<string, string>>(opts: Options, fn: (ctx: Ctx<P>) => Promise<Response | unknown>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      checkOrigin(req);
      const viewer = opts.access === "admin" ? await requireAdmin() : await requireViewer();
      if (opts.rateLimit) await rateLimit(viewer.id, opts.rateLimit.key, opts.rateLimit.limit, opts.rateLimit.windowSec);
      else if (MUTATING.has(req.method)) await rateLimit(viewer.id, "write", 600, 3600);
      const params = (await context?.params) ?? ({} as P);
      const out = await fn({ req, viewer, params });
      return out instanceof Response ? out : json(out ?? { ok: true });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export function toErrorResponse(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return json({ error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.", code: "VALIDATION" }, 400);
  }
  const pg = e as { code?: string };
  if (pg?.code === "23505") return json({ error: "That already exists.", code: "CONFLICT" }, 409);
  if (pg?.code === "23503") return json({ error: "A referenced item no longer exists.", code: "NOT_FOUND" }, 404);
  if (pg?.code === "23514" || pg?.code === "22P02") return json({ error: "Invalid input.", code: "VALIDATION" }, 400);
  console.error("[api] unhandled error", e);
  return json({ error: "Something went wrong. Please try again.", code: "INTERNAL" }, 500);
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw badRequest("Expected a JSON body.");
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw badRequest("Malformed JSON.");
  }
  return schema.parse(data);
}

export const uuid = z.string().uuid();
export function parseId(v: string | undefined) {
  const r = uuid.safeParse(v);
  if (!r.success) throw new ApiError(404, "Not found", "NOT_FOUND");
  return r.data;
}
export const code6 = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().length(6));
