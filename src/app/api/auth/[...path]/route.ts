import { auth } from "@/server/auth";

// Proxies all auth requests to Neon Auth. Session cookies are HttpOnly and set by the SDK.
type Ctx = { params: Promise<{ path: string[] }> };
export const GET = (req: Request, ctx: Ctx) => auth().handler().GET(req, ctx);
export const POST = (req: Request, ctx: Ctx) => auth().handler().POST(req, ctx);
