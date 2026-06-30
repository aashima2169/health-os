// app/api/agents/experiment/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callGeminiAgent } from '../../../../../lib/agents/gemini'
import { EXPERIMENT_PROMPT, EXPERIMENT_VERSION } from '../../../../../lib/agents/prompts'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const result = await callGeminiAgent({
      agentId: 'A2',
      promptVersion: EXPERIMENT_VERSION,
      systemPrompt: EXPERIMENT_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `Design a health experiment based on this input:\n\n${JSON.stringify(body, null, 2)}\n\nReturn a single experiment as JSON matching the ExperimentAgentOutput schema.`,
        },
      ],
      temperature: 0.4,
      maxOutputTokens: 1500,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[A2] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}