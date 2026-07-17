// lib/supabaseServer.ts
// Request-scoped Supabase client for server-side code (API routes only).
// Unlike lib/supabase.ts's browser client, this one is bound to the
// incoming request's cookies each time it's called, so it correctly
// carries the signed-in user's session — required for RLS (auth.uid())
// to resolve server-side. Mirrors the pattern already used in
// middleware.ts and app/auth/callback/route.ts.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createRequestClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )
}
