// app/api/agents/tcm-refresh/route.ts
// Scoped refresh for the TCM specialist (A3e) only, triggered by a new
// tongue photo upload — not a full board refresh. The specialist board is
// otherwise fully manual (only regenerates on Insights' Refresh button,
// see the earlier check-in-cascade removal), which means a fresh tongue
// photo could otherwise sit unread by Signals' domain_reads.energy_patterns
// for weeks until the user happens to hit Refresh. Reuses runTcmPractitioner
// as-is — no changes to its prompt or logic, only to when it's called.
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { runTcmPractitioner } from '../../../../lib/agents/specialistBoard'
import { invalidateAgents } from '../../../../lib/agents/store'
import { getStoredBloodIntelligence, analyzeBloodIntelligence } from '../../../../lib/agents/bloodIntelligence'
import { regenerateSignals } from '../../../../lib/agents/signals'
import { getFullHistory } from '../../../../lib/db'
import { daysForPeriod, isValidPeriod, Period } from '../../../../lib/date'
import { createRequestClient } from '../../../../lib/supabaseServer'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const periodParam = searchParams.get('period')
    const period: Period = isValidPeriod(periodParam) ? periodParam : 'month'

    const client = await createRequestClient()
    waitUntil(
      (async () => {
        await invalidateAgents(client, ['A3e'])

        const [storedBlood, history] = await Promise.all([
          getStoredBloodIntelligence(client),
          getFullHistory(daysForPeriod(period), client),
        ])
        const bloodResult = storedBlood?.result ?? (await analyzeBloodIntelligence(client))

        await runTcmPractitioner(client, bloodResult, history, period)

        // TCM's fresh read only matters to the person once Signals has
        // picked it up too.
        await regenerateSignals(client, period).catch((err) =>
          console.error('[tcm-refresh -> SIGNALS cascade] failed:', err),
        )
      })().catch((err) => console.error('[tcm-refresh] failed:', err)),
    )

    return NextResponse.json({ status: 'generating' })
  } catch (err) {
    console.error('[tcm-refresh] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
