import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const NOT_CONFIGURED = {
  message: 'Supabase is not configured on the server. Add the NEXT_PUBLIC_SUPABASE_* env vars to enable accounts.',
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
  b.order = chain
  b.limit = chain
  b.range = chain
  b.single = chain
  b.maybeSingle = chain
  b.then = (resolve: any, reject: any) =>
    Promise.resolve({ data: null, error: NOT_CONFIGURED }).then(resolve, reject)
  return b
}

type ServerClient = SupabaseClient

function createStubServerClient(): ServerClient {
  const stub = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: NOT_CONFIGURED }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: NOT_CONFIGURED }),
      signOut: async () => ({ error: null }),
    },
    from: () => stubQueryBuilder(),
  }
  return stub as unknown as ServerClient
}

export async function createClient() {
  const cookieStore = await cookies()

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createStubServerClient()
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
