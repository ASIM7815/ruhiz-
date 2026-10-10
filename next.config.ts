import type { NextConfig } from "next";

// Media is served via short-lived redirects to Neon Object Storage, so its origin must be allowed for img/media.
const storageOrigin = (() => {
  try {
    return process.env.NEON_STORAGE_ENDPOINT ? new URL(process.env.NEON_STORAGE_ENDPOINT).origin : "";
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storageOrigin}`.trim(),
  `media-src 'self' blob: ${storageOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${storageOrigin}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
