// lib/supabaseAdmin.ts
// Service-role client — bypasses RLS entirely. Server-only, imported by
// exactly two files: scripts/create-demo-user.mjs and
// app/api/demo/route.ts, both of which need to act on the fixed demo
// account without a real session. Never import this anywhere reachable
// from client code, and never use it for anything beyond standing up or
// signing into the demo account — every other server-side data access in
// this app goes through the request-scoped client in lib/supabaseServer.ts
// instead, which stays RLS-bound to whoever is actually signed in.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
