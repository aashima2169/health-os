// app/api/insights/route.ts
import { NextResponse } from 'next/server'
import { getFullHistory } from '../../../lib/db'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

function buildPrompt(data: Awaited<ReturnType<typeof getFullHistory>>): string {
  return `
You are a personal health pattern analyst. Analyse the following health log data and provide insights.

Rules:
- Never make medical diagnoses or medical claims.
- Speak from patterns in the data only.
- Be specific: use numbers, percentages and timeframes where possible.
- Tone: calm, encouraging, like a smart friend who has looked at your data.
- Do not repeat back raw data. Synthesise it.

Data (last 90 days):
${JSON.stringify(data, null, 2)}

Respond ONLY with valid JSON in this exact shape, no markdown, no preamble:
{
  "weekly": "A 2-3 sentence summary of patterns this week.",
  "monthly": "A 2-3 sentence summary of patterns this month.",
  "patterns": [
    "Pattern 1 as a complete sentence.",
    "Pattern 2 as a complete sentence.",
    "Pattern 3 as a complete sentence."
  ],
  "recommendations": [
    "Recommendation 1 as a complete sentence.",
    "Recommendation 2 as a complete sentence."
  ]
}
`.trim()
}

export async function GET() {
  try {
    const data = await getFullHistory(90)

    // If there's very little data, return a placeholder
    const hasEnoughData = data.logs.length >= 3
    if (!hasEnoughData) {
      return NextResponse.json({
        weekly: 'Log at least 3 days to unlock AI insights.',
        monthly: 'Keep checking in daily and patterns will appear here.',
        patterns: [],
        recommendations: ['Complete your first week of check-ins to see personalised patterns.'],
      })
    }

    const prompt = buildPrompt(data)

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[insights] Gemini error:', err)
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
    }

    const geminiData = await response.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[insights] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}