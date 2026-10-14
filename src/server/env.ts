import "server-only";

/** Server-only configuration. Nothing here is ever sent to the browser. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("NEON_DATABASE_URL");
  },
  get authBaseUrl() {
    return required("NEON_AUTH_BASE_URL");
  },
  get cookieSecret() {
    const s = required("NEON_AUTH_COOKIE_SECRET");
    if (s.length < 32) throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters.");
    return s;
  },
  /** Comma-separated extra origins allowed to send state-changing requests (production domains). */
  get allowedOrigins(): string[] {
    return (process.env.APP_ORIGIN ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
  },
  storage: {
    get endpoint() {
      return process.env.NEON_STORAGE_ENDPOINT ?? "";
    },
    get region() {
      return process.env.NEON_STORAGE_REGION || "us-east-2";
    },
    get accessKeyId() {
      return process.env.NEON_STORAGE_ACCESS_KEY_ID ?? "";
    },
    get secretAccessKey() {
      return process.env.NEON_STORAGE_SECRET_ACCESS_KEY ?? "";
    },
    get imagesBucket() {
      return process.env.NEON_STORAGE_IMAGES_BUCKET || "images";
    },
    get videoBucket() {
      return process.env.NEON_STORAGE_VIDEO_BUCKET || "videos";
    },
    get configured() {
      return Boolean(this.endpoint && this.accessKeyId && this.secretAccessKey);
    },
  },
};
