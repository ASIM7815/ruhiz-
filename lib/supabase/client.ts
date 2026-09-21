import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

const NOT_CONFIGURED = {
  message: 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts.',
}

function stubQueryBuilder(): any {
  const b: any = {}
  const chain = () => b
  b.select = chain
  b.insert = chain
  b.update = chain
  b.upsert = chain
  b.delete = chain
  b.eq = chain
  b.neq = chain
  b.gt = chain
  b.gte = chain
  b.lt = chain
  b.lte = chain
  b.order = chain
  b.limit = chain
  b.range = chain
  b.single = chain
  b.maybeSingle = chain
  b.match = chain
  b.in = chain
  b.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: null, error: NOT_CONFIGURED }).then(resolve, reject)
  b.catch = (reject: any) => b.then(undefined, reject)
  return b
}

type BrowserClient = SupabaseClient

/** A harmless stand-in used when Supabase env vars are absent, so the app can boot and surface a clear configuration error instead of crashing. */
function createStubClient(): BrowserClient {
  const stub = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: NOT_CONFIGURED }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: NOT_CONFIGURED }),
      signInWithOtp: async () => ({ data: {}, error: NOT_CONFIGURED }),
      signUp: async () => ({ data: { user: null, session: null }, error: NOT_CONFIGURED }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: { user: null }, error: NOT_CONFIGURED }),
      resetPasswordForEmail: async () => ({ data: {}, error: NOT_CONFIGURED }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: NOT_CONFIGURED }),
      verifyOtp: async () => ({ data: { user: null, session: null }, error: NOT_CONFIGURED }),
    },
    from: () => stubQueryBuilder(),
  }
  return stub as unknown as BrowserClient
}

export function createClient(): BrowserClient {
  if (!isSupabaseConfigured()) return createStubClient()
  
  // Return singleton instance
  if (browserClient) return browserClient
  
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}

/** Returns a real client only when Supabase env vars exist, otherwise null. */
export function safeClient() {
  if (!isSupabaseConfigured()) return null
  
  // Return singleton instance
  if (browserClient) return browserClient
  
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
