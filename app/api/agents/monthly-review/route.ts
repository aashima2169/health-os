// app/api/agents/monthly-review/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiAgent } from '../../../../lib/agents/gemini'
import { MONTHLY_REVIEW_PROMPT, MONTHLY_REVIEW_VERSION } from '../../../../lib/agents/prompts'
import { supabase } from '../../../../lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // e.g. "2026-06"

    if (!month) {
      return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
    }

    const [year, mo] = month.split('-').map(Number)
    const start = `${year}-${String(mo).padStart(2, '0')}-01`
    const end = new Date(year, mo, 0).toISOString().split('T')[0] // last day of month

    // Fetch all data for the month in parallel
    const [logs, mentalStates, meals, exercise, supplements, flares, periods, experiments] =
      await Promise.all([
        supabase.from('daily_logs').select('*').gte('log_date', start).lte('log_date', end),
        supabase.from('daily_mental_states').select('*').gte('log_date', start).lte('log_date', end),
        supabase.from('meals').select('*').gte('log_date', start).lte('log_date', end),
        supabase.from('daily_exercise').select('*').gte('log_date', start).lte('log_date', end),
        supabase.from('daily_supplements').select('*').gte('log_date', start).lte('log_date', end),
        supabase.from('flares').select('*').gte('start_date', start).lte('start_date', end),
        supabase.from('periods').select('*').gte('start_date', start).lte('start_date', end),
        supabase.from('experiments').select('*').gte('created_at', start).lte('created_at', end),
      ])

    const monthLabel = new Date(year, mo - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    })

    const result = await callGeminiAgent({
      agentId: 'A8',
      promptVersion: MONTHLY_REVIEW_VERSION,
      systemPrompt: MONTHLY_REVIEW_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `Generate a monthly health review for ${monthLabel}.\n\nData:\n${JSON.stringify({
            month: monthLabel,
            daily_logs: logs.data ?? [],
            mental_states: mentalStates.data ?? [],
            meals: meals.data ?? [],
            exercise: exercise.data ?? [],
            supplements: supplements.data ?? [],
            flares: flares.data ?? [],
            periods: periods.data ?? [],
            experiments: experiments.data ?? [],
          }, null, 2)}`,
        },
      ],
      temperature: 0.5,
      maxOutputTokens: 2000,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[A8] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}