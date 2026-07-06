// app/api/agents/questions/route.ts
// GET: all questions specialists have asked, with any answers already given.
// POST: save/update an answer. Saving invalidates the specialist board
// cache and kicks off a background regeneration (via waitUntil, so it
// survives past this response) so the answer actually feeds into the
// next analysis.
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { getAllQuestions, saveAnswer } from '../../../../lib/agents/qa'
import { invalidateAgents } from '../../../../lib/agents/store'
import { SPECIALIST_AGENT_IDS } from '../../../../lib/agents/specialistBoard'
import { regenerateHealthIntelligence } from '../../../../lib/agents/healthIntelligence'

export const maxDuration = 280

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

    waitUntil(
      (async () => {
        await invalidateAgents([...SPECIALIST_AGENT_IDS, 'A3'])
        await regenerateHealthIntelligence('week').catch((err) =>
          console.error('[questions] background regeneration failed:', err),
        )
      })().catch((err) => console.error('[questions] invalidate failed:', err))
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[questions POST] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}