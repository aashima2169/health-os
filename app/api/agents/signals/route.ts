// app/api/agents/signals/route.ts
// Signals — GET returns the currently persisted active hypotheses only.
// AI analysis is fully manual now (same model as the specialist board) —
// this route never triggers generation itself, only the POST "check for
// new patterns" handler below does. This avoids a quota-burning retry
// storm: a failed pass retries up to 3x internally, and if GET kept
// auto-triggering on every poll/visit while a pass was failing, a single
// bad API day could silently exhaust the whole daily Gemini quota just
// from background polling. See lib/agents/signals.ts.
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getSignalsStatus, regenerateSignals } from '../../../../lib/agents/signals'
import { getActiveSignals } from '../../../../lib/agents/signalsStore'
import { isValidPeriod, Period } from '../../../../lib/date'
import { createRequestClient } from '../../../../lib/supabaseServer'

export const maxDuration = 280

export async function GET() {
  try {
    const client = await createRequestClient()
    const signals = await getActiveSignals(client)
    const status = await getSignalsStatus(client)

    if (status && status.status === 'success') {
      return NextResponse.json({ status: 'success', signals, generated_at: status.generated_at })
    }

    // A 'generating' status is only trustworthy if recent — otherwise
    // whatever process set it likely died without ever updating it.
    const STALE_MS = 6 * 60 * 1000
    const isStale = !!status?.generated_at && (Date.now() - new Date(status.generated_at).getTime() > STALE_MS)

    if (status && status.status === 'generating' && !isStale) {
      return NextResponse.json({ status: 'generating', signals, generated_at: status.generated_at })
    }

    // Nothing stored, or stale/errored — that just means "not generated
    // yet", not a signal to kick off work automatically.
    return NextResponse.json({
      status: 'success',
      has_data: false,
      message: 'Not generated yet — tap Refresh to check for patterns.',
      signals,
      generated_at: null,
    })
  } catch (err) {
    console.error('[SIGNALS] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Manual "check for new patterns" trigger — always forces a fresh pass,
// regardless of what's currently stored (the claim lock in
// regenerateSignals still prevents a duplicate concurrent run).
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const client = await createRequestClient()
    waitUntil(
      regenerateSignals(client, period).catch((err) => console.error('[SIGNALS] manual regenerate failed:', err))
    )
    return NextResponse.json({ status: 'generating' })
  } catch (err) {
    console.error('[SIGNALS] manual regenerate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
