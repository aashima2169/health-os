// lib/agents/bloodIntelligence.ts
// A1: Blood Intelligence — analyses blood reports ONLY, no lifestyle data.
// Period-independent (always stored under period 'all'), since it reflects
// the latest blood report regardless of what lifestyle timeframe is
// selected elsewhere.
import { supabase } from '../supabase'
import { callGeminiAgent } from './gemini'
import { BLOOD_INTELLIGENCE_PROMPT, BLOOD_INTELLIGENCE_VERSION } from './prompts'
import { getAgentResult, saveAgentResult, markGenerating, invalidateAgents } from './store'
import { regenerateHealthIntelligence } from './healthIntelligence'
import { SPECIALIST_AGENT_IDS } from './specialistBoard'

export async function analyzeBloodIntelligence(): Promise<Record<string, any>> {
  const { data: reports, error } = await supabase
    .from('blood_reports')
    .select('id, report_date, markers, notes, extraction_status')
    .eq('extraction_status', 'success')
    .order('report_date', { ascending: true })

  if (error) throw error

  if (!reports || reports.length === 0) {
    return {
      agent_id: 'A1',
      prompt_version: BLOOD_INTELLIGENCE_VERSION,
      message: 'No successfully extracted blood reports found. Upload a report first.',
      has_data: false,
    }
  }

  const latest = reports[reports.length - 1]
  const previous = reports.length >= 2 ? reports[reports.length - 2] : null

  const result = await callGeminiAgent<Record<string, any>>({
    agentId: 'A1',
    promptVersion: BLOOD_INTELLIGENCE_VERSION,
    systemPrompt: BLOOD_INTELLIGENCE_PROMPT,
    userParts: [
      {
        type: 'text',
        text: `Analyse these blood reports.

Latest report (${latest.report_date}):
${JSON.stringify(latest.markers, null, 2)}

${previous
  ? `Previous report (${previous.report_date}):\n${JSON.stringify(previous.markers, null, 2)}`
  : 'No previous report available for comparison.'
}

${reports.length > 2
  ? `All report dates for trend context: ${reports.map((r) => r.report_date).join(', ')}`
  : ''
}`,
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 8192,
  })

  return { ...result, has_data: true, report_count: reports.length }
}

// Runs A1, persists it, then cascades to regenerate A3 (default period).
// Marks 'generating' immediately so a concurrent poll sees progress
// instead of nothing, and to avoid a second redundant trigger firing
// while this one is still in flight.
export async function regenerateBloodIntelligence(): Promise<Record<string, any>> {
  await markGenerating('A1', 'all')
  try {
    const result = await analyzeBloodIntelligence()
    await saveAgentResult('A1', result, { period: 'all', version: BLOOD_INTELLIGENCE_VERSION })

    // New blood data can change every specialist's read (all five now
    // receive Blood Intelligence as context), so their cached results
    // across every period are stale — clear them so A3's regeneration
    // below actually re-runs them instead of reusing stale reads.
    await invalidateAgents(SPECIALIST_AGENT_IDS)

    regenerateHealthIntelligence().catch((err) =>
      console.error('[A1 -> A3 cascade] failed:', err),
    )

    return result
  } catch (err) {
    console.error('[A1] regenerate failed:', err)
    await saveAgentResult('A1', {}, { period: 'all', version: BLOOD_INTELLIGENCE_VERSION, status: 'error', error: String(err) })
    throw err
  }
}

export async function getStoredBloodIntelligence() {
  return getAgentResult('A1', 'all')
}