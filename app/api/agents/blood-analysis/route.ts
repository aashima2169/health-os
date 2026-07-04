// app/api/agents/blood-analysis/route.ts
// A1: Blood Intelligence — reads the stored result. If nothing is stored
// yet, kicks off generation in the background and returns immediately
// with status 'generating' so the frontend can show a loader and poll
// rather than blocking on a 15-30s response.
import { NextResponse } from 'next/server'
import { getStoredBloodIntelligence, regenerateBloodIntelligence } from '../../../../lib/agents/bloodIntelligence'

export async function GET() {
  try {
    const stored = await getStoredBloodIntelligence()

    if (stored && stored.status === 'success') {
      return NextResponse.json({ ...stored.result, status: 'success', generated_at: stored.generated_at })
    }
    if (stored && stored.status === 'generating') {
      return NextResponse.json({ status: 'generating', generated_at: stored.generated_at })
    }

    // Nothing stored yet at all — bootstrap in the background, don't block.
    regenerateBloodIntelligence().catch((err) => console.error('[A1] bootstrap failed:', err))
    return NextResponse.json({ status: 'generating', generated_at: null })
  } catch (err) {
    console.error('[A1] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}