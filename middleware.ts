import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets:
     * - _next/static, _next/image, favicon / icon files
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
