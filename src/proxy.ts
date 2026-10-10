import { auth } from "@/server/auth";
import type { NextRequest } from "next/server";

/**
 * Route protection: signed-out visitors are redirected to Sign In for app pages.
 * API routes and pages also check the session themselves (defence in depth).
 */
export default function proxy(req: NextRequest) {
  return auth().middleware({ loginUrl: "/sign-in" })(req);
}

export const config = {
  matcher: [
    "/home/:path*",
    "/welcome/:path*",
    "/explore/:path*",
    "/support/:path*",
    "/messages/:path*",
    "/profile/:path*",
    "/post/:path*",
    "/solution/:path*",
    "/contributions/:path*",
    "/saved/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/admin/:path*",
  ],
};
