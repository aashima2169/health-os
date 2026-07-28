// app/api/demo/route.ts
// Auto-login into the fixed, read-only demo account — no password, no
// OAuth screen. Uses the service-role admin client (server-only) to
// generate a magic-link token for demo@flarewise.app, then verifies that
// token against a cookie-bound server client so the session gets written
// as real cookies, exactly like app/auth/callback/route.ts does for a
// real Google sign-in. From here on the visitor is just a normal signed-
// in user against an account whose RLS policies happen to block writes
// (see supabase/phase_demo_readonly.sql).
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../lib/supabaseAdmin'

const DEMO_EMAIL = 'demo@flarewise.app'

export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: DEMO_EMAIL,
    })
    if (error || !data?.properties?.hashed_token) {
      console.error('[demo] failed to generate link:', error)
      return NextResponse.json({ error: 'Demo account is not set up yet' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: data.properties.hashed_token,
    })
    if (verifyError) {
      console.error('[demo] failed to verify link:', verifyError)
      return NextResponse.json({ error: 'Could not start the demo session' }, { status: 500 })
    }

    const { origin } = new URL(request.url)
    return NextResponse.redirect(`${origin}/today`)
  } catch (err) {
    console.error('[demo] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
