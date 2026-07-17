// app/api/check-in/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { saveCheckIn } from '../../../lib/db'
import { invalidateAgents } from '../../../lib/agents/store'
import { SPECIALIST_AGENT_IDS } from '../../../lib/agents/specialistBoard'
import { createRequestClient } from '../../../lib/supabaseServer'
import type { CheckInPayload } from '../../../types'

export const maxDuration = 280

export async function POST(req: NextRequest) {
  try {
    const payload: CheckInPayload = await req.json()

    if (!payload.log_date) {
      return NextResponse.json({ error: 'log_date is required' }, { status: 400 })
    }

    const client = await createRequestClient()
    await saveCheckIn(payload, client)

    // AI analysis is fully manual now — Refresh on Insights is the only
    // trigger. A check-in still invalidates every cached read it could
    // have affected (a new day shifts every rolling window), so the next
    // Refresh recomputes from fresh data instead of silently reusing a
    // now-stale cache; it just doesn't spend a Gemini call automatically.
    await invalidateAgents(client, ['A2', ...SPECIALIST_AGENT_IDS, 'A3'])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[check-in] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')

  if (!date) {
    return NextResponse.json({ error: 'date param required' }, { status: 400 })
  }

  try {
    const client = await createRequestClient()
    const { getLog, getMentalStates, getMeals, getExercise, getSupplements } = await import('../../../lib/db')
    const [log, mentalStates, foods, exerciseTypes, supplements] = await Promise.all([
      getLog(date, client),
      getMentalStates(date, client),
      getMeals(date, client),
      getExercise(date, client),
      getSupplements(date, client),
    ])
    return NextResponse.json({ log, mentalStates, foods, exerciseTypes, supplements })
  } catch (err) {
    console.error('[check-in GET] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
