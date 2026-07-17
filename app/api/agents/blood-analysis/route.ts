// app/api/agents/blood-analysis/route.ts
// A1: Blood Intelligence — reads the stored result. If nothing is stored
// yet, kicks off generation via waitUntil (survives past this response)
// and returns 'generating' immediately.
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getStoredBloodIntelligence, regenerateBloodIntelligence } from '../../../../lib/agents/bloodIntelligence'
import { createRequestClient } from '../../../../lib/supabaseServer'

export const maxDuration = 280

export async function GET() {
  try {
    const client = await createRequestClient()
    const stored = await getStoredBloodIntelligence(client)

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }

    // A 'generating' status is only trustworthy if it's recent — if it's
    // been sitting for a while, whatever process set it likely died
    // (Vercel invocation killed, crash, etc.) without ever updating it.
    const STALE_MS = 6 * 60 * 1000
    const isStale = !!stored?.generated_at && (Date.now() - new Date(stored.generated_at).getTime() > STALE_MS)

    if (stored && stored.status === 'generating' && !isStale) {
      return NextResponse.json({ status: 'generating', generated_at: stored.generated_at })
    }

    // AI analysis is fully manual now — Refresh on Insights is the only
    // trigger (see the POST handler below). Nothing stored, or stale, just
    // means "not generated yet" — it's not a signal to kick off work.
    return NextResponse.json({
      status: 'success',
      has_data: false,
      message: 'Not generated yet — tap Refresh to analyse your latest report.',
      generated_at: null,
    })
  } catch (err) {
    console.error('[A1] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Manual "regenerate now" trigger — this is what the Refresh button should
// call. The GET route above correctly trusts a 'success' cached result and
// returns it immediately, which means a plain page reload can never force
// a fresh run once something's cached. This is the only path that
// actually forces regeneration regardless of what's currently stored.
export async function POST() {
  try {
    const client = await createRequestClient()
    waitUntil(
      regenerateBloodIntelligence(client).catch((err) => console.error('[A1] manual regenerate failed:', err))
    )
    return NextResponse.json({ status: 'generating' })
  } catch (err) {
    console.error('[A1] manual regenerate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
