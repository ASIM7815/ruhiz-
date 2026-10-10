import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { env } from "./env";

type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: NeonAuth | null = null;

/** Lazily created so `next build` does not require secrets at import time. */
export function auth(): NeonAuth {
  if (!instance) {
    instance = createNeonAuth({
      baseUrl: env.authBaseUrl,
      cookies: { secret: env.cookieSecret },
      logLevel: "warn",
    });
  }
  return instance;
}
