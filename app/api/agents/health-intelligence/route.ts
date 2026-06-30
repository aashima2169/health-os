// app/api/agents/health-intelligence/route.ts
// FIXED: callGeminiAgent<T> was called without a type argument, so `result`
// inferred as `unknown`, which can't be spread with `{ ...result, period }`.
// Now explicitly typed as Record<string, any>.
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiAgent } from '../../../../lib/agents/gemini'
import { HEALTH_INTELLIGENCE_PROMPT, HEALTH_INTELLIGENCE_VERSION } from '../../../../lib/agents/prompts'
import { getFullHistory } from '../../../../lib/db'

type Period = 'week' | 'month' | 'quarter' | 'year' | 'last_month' | 'this_month'

function daysForPeriod(period: Period): number {
  switch (period) {
    case 'week': return 7
    case 'month': return 30
    case 'this_month': return 31
    case 'last_month': return 60
    case 'quarter': return 90
    case 'year': return 365
    default: return 30
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') as Period) || 'month'

    const days = daysForPeriod(period)
    const data = await getFullHistory(days)

    let filteredData = data
    if (period === 'this_month' || period === 'last_month') {
      const now = new Date()
      const targetMonth = period === 'this_month' ? now.getMonth() : now.getMonth() - 1
      const targetYear = now.getFullYear()
      const inMonth = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        return d.getMonth() === ((targetMonth + 12) % 12) && d.getFullYear() === targetYear
      }
      filteredData = {
        logs: data.logs.filter((l: any) => inMonth(l.log_date)),
        mentalStates: data.mentalStates.filter((m: any) => inMonth(m.log_date)),
        meals: data.meals.filter((m: any) => inMonth(m.log_date)),
        exercise: data.exercise.filter((e: any) => inMonth(e.log_date)),
        recovery: data.recovery.filter((r: any) => inMonth(r.log_date)),
        supplements: data.supplements.filter((s: any) => inMonth(s.log_date)),
        healthEvents: data.healthEvents.filter((h: any) => inMonth(h.start_date)),
        periods: data.periods.filter((p: any) => inMonth(p.start_date)),
      }
    }

    if (filteredData.logs.length < 3) {
      return NextResponse.json({
        agent_id: 'A1',
        prompt_version: HEALTH_INTELLIGENCE_VERSION,
        period,
        data_quality: { score: 10, gaps: ['Not enough days logged for this period'], note: `Log a few more days in this ${period.replace('_', ' ')} to unlock insights.` },
        patterns: [],
        what_keeps_happening: 'Not enough data yet for this time range.',
        what_triggers_it: 'Not enough data yet for this time range.',
        what_helps: 'Not enough data yet for this time range.',
        what_to_observe_next: ['Try a different time range, or keep logging daily.'],
        experiments_to_consider: [],
        summary: 'Keep logging and patterns will emerge here.',
        questions_for_doctor: [],
        overall_confidence: 0,
        limitations: 'Insufficient data for the selected period.',
      })
    }

    // Explicit type argument fixes the "spread types may only be created
    // from object types" error — without <Record<string, any>>, result is
    // `unknown` and can't be spread.
    const result = await callGeminiAgent<Record<string, any>>({
      agentId: 'A1',
      promptVersion: HEALTH_INTELLIGENCE_VERSION,
      systemPrompt: HEALTH_INTELLIGENCE_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `Analyse this health data for the period: ${period.replace('_', ' ')}.\n\nData:\n${JSON.stringify(filteredData, null, 2)}\n\nReturn a single "summary" field (2-4 sentences) covering this specific time range, instead of separate weekly_summary/monthly_summary fields.`,
        },
      ],
      temperature: 0.4,
      maxOutputTokens: 3000,
    })

    return NextResponse.json({ ...result, period })
  } catch (err) {
    console.error('[A1] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}