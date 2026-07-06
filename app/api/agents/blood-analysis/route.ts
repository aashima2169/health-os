// app/api/agents/blood-analysis/route.ts
// A1: Blood Intelligence — reads the stored result. If nothing is stored
// yet, kicks off generation via waitUntil (survives past this response)
// and returns 'generating' immediately.
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getStoredBloodIntelligence, regenerateBloodIntelligence } from '../../../../lib/agents/bloodIntelligence'

export const maxDuration = 280

export async function GET() {
  try {
    const stored = await getStoredBloodIntelligence()

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }

    // A 'generating' status is only trustworthy if it's recent — if it's
    // been sitting for a while, whatever process set it likely died
    // (Vercel invocation killed, crash, etc.) without ever updating it.
    // Previously this route trusted 'generating' forever, meaning a
    // frozen row NEVER got retried by any future request — the atomic
    // claim in regenerateBloodIntelligence() never even got invoked,
    // correct or not, because the route bailed out before reaching it.
    const STALE_MS = 6 * 60 * 1000
    const isStale = stored?.generated_at && (Date.now() - new Date(stored.generated_at).getTime() > STALE_MS)

    if (stored && stored.status === 'generating' && !isStale) {
      return NextResponse.json({ status: 'generating', generated_at: stored.generated_at })
    }

    // Nothing stored, or stored-but-stale — try again. The atomic claim
    // inside regenerateBloodIntelligence() safely handles the case where
    // another request is genuinely, actively working on it right now.
    waitUntil(
      regenerateBloodIntelligence().catch((err) => console.error('[A1] bootstrap failed:', err))
    )
    return NextResponse.json({ status: 'generating', generated_at: null })
  } catch (err) {
    console.error('[A1] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}