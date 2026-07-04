// app/api/agents/health-intelligence/route.ts
// A3: Health Intelligence — reads the stored consolidated board result for
// the requested period. If that period hasn't been generated yet, kicks
// off generation in the background and returns 'generating' immediately —
// the frontend should poll this same endpoint until status flips to
// 'success' (or 'error'), rather than the request blocking for 90+ seconds.
//
// While generating, the response includes a live `board` snapshot read
// directly from the DB — each specialist is persisted the moment it
// finishes, independently, so the frontend can render specialist cards
// as they complete rather than waiting for the whole board + consolidator.
import { NextRequest, NextResponse } from 'next/server'
import { getStoredHealthIntelligence, regenerateHealthIntelligence } from '../../../../lib/agents/healthIntelligence'
import { getSpecialistBoardSnapshot } from '../../../../lib/agents/specialistBoard'
import { isValidPeriod, Period } from '../../../../lib/date'
import type { AgentInsightRow } from '../../../../lib/agents/store'

// The raw snapshot returns DB rows ({status, result, error, generated_at}).
// The final consolidated result's `board` field is flattened specialist
// output directly. Normalizing here means the frontend only ever handles
// one shape, whether it's mid-generation or done.
function normalizeBoard(raw: Awaited<ReturnType<typeof getSpecialistBoardSnapshot>>) {
  const flatten = (row: AgentInsightRow | null) => {
    if (!row) return { status: 'generating' as const, has_data: false }
    if (row.status === 'success') return { status: 'success' as const, ...row.result }
    return { status: row.status, has_data: false, error: row.error ?? undefined }
  }
  return {
    physician: flatten(raw.physician),
    dermatologist: flatten(raw.dermatologist),
    psychologist: flatten(raw.psychologist),
    gutMicrobiomeDoctor: flatten(raw.gutMicrobiomeDoctor),
    tcmPractitioner: flatten(raw.tcmPractitioner),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const stored = await getStoredHealthIntelligence(period)

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }

    // Whether we're mid-generation already or about to bootstrap one,
    // include whatever specialist results already exist for this period
    // so the frontend can render progressively instead of a blank card.
    const board = normalizeBoard(await getSpecialistBoardSnapshot(period))

    if (stored && stored.status === 'generating') {
      return NextResponse.json({ status: 'generating', period, generated_at: stored.generated_at, board })
    }

    regenerateHealthIntelligence(period).catch((err) => console.error('[A3] bootstrap failed:', err))
    return NextResponse.json({ status: 'generating', period, generated_at: null, board })
  } catch (err) {
    console.error('[A3] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Manual "regenerate now" trigger for a specific period, e.g. a refresh
// button in the UI. Pass ?force=true to bypass the specialist cache and
// force every specialist to genuinely re-run rather than reuse a prior
// success — normal event-driven cascades don't need this since they
// already invalidate the cache themselves when data actually changes.
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'
    const force = searchParams.get('force') === 'true'

    regenerateHealthIntelligence(period, { force }).catch((err) => console.error('[A3] manual regenerate failed:', err))
    return NextResponse.json({ status: 'generating', period })
  } catch (err) {
    console.error('[A3] manual regenerate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}