import { NextResponse } from 'next/server';

/**
 * Legacy endpoint from the previous product. DUEL signs in with email +
 * password (or the local preview account); usernames are display-only.
 */
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: 'DUEL login uses email and password. Username is only a profile/display field.' },
    { status: 410 }
  );
}
