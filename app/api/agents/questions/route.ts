// app/api/agents/questions/route.ts
// GET: all questions specialists have asked, with any answers already given.
// POST: save/update an answer. Saving invalidates the specialist board
// cache so the answer feeds into the next analysis — AI analysis itself is
// fully manual now, triggered only by Refresh on Insights, so this no
// longer fires a regeneration automatically.
import { NextRequest, NextResponse } from 'next/server'
import { getAllQuestions, saveAnswer } from '../../../../lib/agents/qa'
import { invalidateAgents } from '../../../../lib/agents/store'
import { SPECIALIST_AGENT_IDS } from '../../../../lib/agents/specialistBoard'
import { createRequestClient } from '../../../../lib/supabaseServer'

export const maxDuration = 280

export async function GET() {
  try {
    const client = await createRequestClient()
    const questions = await getAllQuestions(client)
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

    const client = await createRequestClient()
    await saveAnswer(client, agent_id, question, answer)
    await invalidateAgents(client, [...SPECIALIST_AGENT_IDS, 'A3'])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[questions POST] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
