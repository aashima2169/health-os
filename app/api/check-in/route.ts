// app/api/check-in/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { saveCheckIn } from '../../../lib/db'
import type { CheckInPayload } from '../../../types'

export async function POST(req: NextRequest) {
  try {
    const payload: CheckInPayload = await req.json()

    if (!payload.log_date) {
      return NextResponse.json({ error: 'log_date is required' }, { status: 400 })
    }

    await saveCheckIn(payload)
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
    const { getLog, getMentalStates, getMeals, getExercise, getSupplements } = await import('../../../lib/db')
    const [log, mentalStates, foods, exerciseTypes, supplements] = await Promise.all([
      getLog(date),
      getMentalStates(date),
      getMeals(date),
      getExercise(date),
      getSupplements(date),
    ])
    return NextResponse.json({ log, mentalStates, foods, exerciseTypes, supplements })
  } catch (err) {
    console.error('[check-in GET] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}