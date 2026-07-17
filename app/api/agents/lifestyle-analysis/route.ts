// app/api/agents/lifestyle-analysis/route.ts
// A2: Lifestyle Intelligence — reads the stored result for the requested
// period only. AI analysis is fully manual (see below) — this route never
// triggers generation itself.
import { NextRequest, NextResponse } from 'next/server'
import { getStoredLifestyleIntelligence } from '../../../../lib/agents/lifestyleIntelligence'
import { isValidPeriod, Period } from '../../../../lib/date'
import { createRequestClient } from '../../../../lib/supabaseServer'

export const maxDuration = 280

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const client = await createRequestClient()
    const stored = await getStoredLifestyleIntelligence(client, period)

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }

    // See blood-analysis/route.ts for why staleness matters here.
    const STALE_MS = 6 * 60 * 1000
    const isStale = !!stored?.generated_at && (Date.now() - new Date(stored.generated_at).getTime() > STALE_MS)

    if (stored && stored.status === 'generating' && !isStale) {
      return NextResponse.json({ status: 'generating', period, generated_at: stored.generated_at })
    }

    // AI analysis is fully manual now. This route has no POST/Refresh
    // trigger of its own (A2 isn't rendered directly in Insights — it only
    // ever fed the check-in cascade, which has been removed), so nothing
    // stored just means "not generated" — no auto-trigger here either.
    return NextResponse.json({
      status: 'success',
      has_data: false,
      message: 'Not generated yet.',
      period,
      generated_at: null,
    })
  } catch (err) {
    console.error('[A2] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}