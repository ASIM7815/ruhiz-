export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const isR2Configured = Boolean(
  typeof window === 'undefined'
    ? process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID
    : true // client cannot know; upload route decides and we fall back gracefully
);

export function demoMode() {
  return !isSupabaseConfigured;
}
