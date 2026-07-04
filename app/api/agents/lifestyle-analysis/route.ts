// app/api/agents/lifestyle-analysis/route.ts
// A2: Lifestyle Intelligence — reads the stored result for the requested
// period. If that period hasn't been generated yet, kicks off generation
// in the background and returns 'generating' immediately.
import { NextRequest, NextResponse } from 'next/server'
import { getStoredLifestyleIntelligence, regenerateLifestyleIntelligence } from '../../../../lib/agents/lifestyleIntelligence'
import { isValidPeriod, Period } from '../../../../lib/date'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const stored = await getStoredLifestyleIntelligence(period)

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }
    if (stored && stored.status === 'generating') {
      return NextResponse.json({ status: 'generating', period, generated_at: stored.generated_at })
    }

    regenerateLifestyleIntelligence(period).catch((err) => console.error('[A2] bootstrap failed:', err))
    return NextResponse.json({ status: 'generating', period, generated_at: null })
  } catch (err) {
    console.error('[A2] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}