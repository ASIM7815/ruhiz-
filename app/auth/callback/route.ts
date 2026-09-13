import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/'
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Successfully exchanged code for session
      // Redirect to the next URL (which should be /auth/verified for email confirmations)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to home if something went wrong
  return NextResponse.redirect(`${origin}/`)
}
