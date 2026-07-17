// middleware.ts
// Refreshes the Supabase session on every request and gates every route
// behind sign-in. Standard @supabase/ssr + Next.js App Router pattern —
// this is what lets the browser client (lib/supabase.ts) and server-side
// code see the same cookie-based session. Also gates every signed-in
// route behind one-time, per-account data consent (see app/consent/page.tsx)
// — checked here, not just on the sign-in page, so it can't be skipped by
// navigating straight to a deep link.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/sign-in', '/auth/callback']
const CONSENT_PATH = '/consent'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // getUser() (not getSession()) actually validates the token against
  // Supabase and refreshes it if needed — getSession() alone would trust
  // a locally-cached, possibly-stale token.
  const { data: { user } } = await supabase.auth.getUser()

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname.startsWith('/sign-in')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: consent } = await supabase
      .from('user_consent')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const onConsentPath = request.nextUrl.pathname.startsWith(CONSENT_PATH)

    if (!consent && !onConsentPath) {
      const url = request.nextUrl.clone()
      url.pathname = CONSENT_PATH
      return NextResponse.redirect(url)
    }

    if (consent && onConsentPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
