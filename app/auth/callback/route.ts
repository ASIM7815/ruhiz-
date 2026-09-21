import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/feed'
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[Auth Callback] Error exchanging code:', {
        message: error.message,
        status: error.status,
        name: error.name,
      })
      // Redirect to login with error message
      return NextResponse.redirect(`${origin}/login?error=verification_failed`)
    }
    
    if (data.session) {
      // Successfully exchanged code for session
      // Redirect to the next URL (which should be /auth/verified for email confirmations)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  console.error('[Auth Callback] No code provided or session creation failed')
  // Return to login if something went wrong
  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
