// app/api/agents/health-intelligence/route.ts
import { NextResponse } from 'next/server'
import { callGeminiAgent } from '../../../../lib/agents/gemini'
import { HEALTH_INTELLIGENCE_PROMPT, HEALTH_INTELLIGENCE_VERSION } from '../../../../lib/agents/prompts'
import { getFullHistory } from '../../../../lib/db'

export async function GET() {
  try {
    const data = await getFullHistory(90)

    if (data.logs.length < 7) {
      return NextResponse.json({
        agent_id: 'A1',
        prompt_version: HEALTH_INTELLIGENCE_VERSION,
        data_quality: { score: 10, gaps: ['Fewer than 7 days logged'], note: 'Log at least 7 days to unlock health intelligence.' },
        patterns: [],
        what_keeps_happening: 'Not enough data yet.',
        what_triggers_it: 'Not enough data yet.',
        what_helps: 'Not enough data yet.',
        what_to_observe_next: ['Complete at least 7 daily check-ins to unlock patterns.'],
        experiments_to_consider: [],
        weekly_summary: 'Keep logging daily and patterns will emerge here.',
        monthly_summary: 'Keep logging daily and patterns will emerge here.',
        questions_for_doctor: [],
        overall_confidence: 0,
        limitations: 'Insufficient data.',
      })
    }

    const result = await callGeminiAgent({
      agentId: 'A1',
      promptVersion: HEALTH_INTELLIGENCE_VERSION,
      systemPrompt: HEALTH_INTELLIGENCE_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `Analyse this health data and return insights.\n\nData:\n${JSON.stringify(data, null, 2)}`,
        },
      ],
      temperature: 0.4,
      maxOutputTokens: 3000,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[A1] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}