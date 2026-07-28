// app/api/agents/health-intelligence/route.ts
// A3: Health Intelligence — reads the stored consolidated board result for
// the requested period. If that period hasn't been generated yet, kicks
// off generation via waitUntil (survives past this response, unlike a
// bare fire-and-forget call, which Vercel would otherwise kill the moment
// the response is sent) and returns 'generating' immediately.
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getStoredHealthIntelligence, regenerateHealthIntelligence } from '../../../../lib/agents/healthIntelligence'
import { getSpecialistBoardSnapshot } from '../../../../lib/agents/specialistBoard'
import { isValidPeriod, Period } from '../../../../lib/date'
import type { AgentInsightRow } from '../../../../lib/agents/store'
import { createRequestClient } from '../../../../lib/supabaseServer'

// Hobby plan with Fluid Compute (default) supports up to 300s — 280 leaves
// margin. The full 6-specialist board + consolidator (~7-8 Gemini calls,
// rate-limited ~13.5s apart) needs this much room in the worst case.
export const maxDuration = 280

function normalizeBoard(raw: Awaited<ReturnType<typeof getSpecialistBoardSnapshot>>) {
  const flatten = (row: AgentInsightRow | null) => {
    // No row at all means this specialist has never run — genuinely
    // different from 'generating' (actively computing right now), which
    // otherwise reads as a stuck/broken loading state for a brand new
    // user who's simply never tapped Refresh yet.
    if (!row) return { status: 'not_generated' as const, has_data: false }
    if (row.status === 'success') return { status: 'success' as const, ...row.result }
    return { status: row.status, has_data: false, error: row.error ?? undefined }
  }
  return {
    physician: flatten(raw.physician),
    dermatologist: flatten(raw.dermatologist),
    psychologist: flatten(raw.psychologist),
    gutMicrobiomeDoctor: flatten(raw.gutMicrobiomeDoctor),
    nutritionist: flatten(raw.nutritionist),
    tcmPractitioner: flatten(raw.tcmPractitioner),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const client = await createRequestClient()
    const stored = await getStoredHealthIntelligence(client, period)

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }

    const board = normalizeBoard(await getSpecialistBoardSnapshot(client, period))

    // A 'generating' status is only trustworthy if recent — see
    // blood-analysis/route.ts for why. A stale one means whatever process
    // set it likely died; fall through and treat it like "never generated"
    // below, same as a missing row.
    const STALE_MS = 6 * 60 * 1000
    const isStale = !!stored?.generated_at && (Date.now() - new Date(stored.generated_at).getTime() > STALE_MS)

    if (stored && stored.status === 'generating' && !isStale) {
      return NextResponse.json({ status: 'generating', period, generated_at: stored.generated_at, board })
    }

    // AI analysis is fully manual now — Refresh on Insights is the only
    // trigger (see the POST handler below). Nothing stored, or stale, just
    // means "not generated yet" — it's not a signal to kick off work.
    return NextResponse.json({
      status: 'success',
      has_data: false,
      message: 'Not generated yet — tap Refresh to check for patterns.',
      period,
      generated_at: null,
      board,
    })
  } catch (err) {
    console.error('[A3] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Manual "regenerate now" trigger for a specific period, e.g. a refresh
// button in the UI.
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const client = await createRequestClient()
    waitUntil(
      regenerateHealthIntelligence(client, period, { force: true }).catch((err) => console.error('[A3] manual regenerate failed:', err))
    )
    return NextResponse.json({ status: 'generating', period })
  } catch (err) {
    console.error('[A3] manual regenerate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}