// app/api/agents/questions/route.ts
// GET: all questions specialists have asked, with any answers already given.
// POST: save/update an answer. Saving invalidates the specialist board
// cache and kicks off a background regeneration so the answer actually
// feeds into the next analysis, rather than just sitting unused.
import { NextRequest, NextResponse } from 'next/server'
import { getAllQuestions, saveAnswer } from '../../../../lib/agents/qa'
import { invalidateAgents } from '../../../../lib/agents/store'
import { SPECIALIST_AGENT_IDS } from '../../../../lib/agents/specialistBoard'
import { regenerateHealthIntelligence } from '../../../../lib/agents/healthIntelligence'

export async function GET() {
  try {
    const questions = await getAllQuestions()
    return NextResponse.json({ questions })
  } catch (err) {
    console.error('[questions GET] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { agent_id, question, answer } = await req.json()
    if (!agent_id || !question || typeof answer !== 'string') {
      return NextResponse.json({ error: 'agent_id, question, and answer are required' }, { status: 400 })
    }

    await saveAnswer(agent_id, question, answer)

    // The answer is new self-reported context every specialist (not just
    // the one that asked) could benefit from — invalidate the whole board
    // across all periods and regenerate the default period in the
    // background so the next Insights visit reflects it.
    invalidateAgents([...SPECIALIST_AGENT_IDS, 'A3']).catch((err) =>
      console.error('[questions] invalidate failed:', err),
    )
    regenerateHealthIntelligence('week').catch((err) =>
      console.error('[questions] background regeneration failed:', err),
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[questions POST] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}