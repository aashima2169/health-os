// lib/agents/healthIntelligence.ts
// A3: Health Intelligence — regenerates the multi-specialist board plus
// consolidator FOR A SPECIFIC PERIOD, and persists it under that period.
// Triggered by A1 or A2 changing (event-driven), not by page load.
import { callGeminiAgent } from './gemini'
import { HEALTH_INTELLIGENCE_PROMPT, HEALTH_INTELLIGENCE_VERSION } from './prompts'
import { runSpecialistBoard, SPECIALIST_AGENT_IDS } from './specialistBoard'
import { analyzeBloodIntelligence } from './bloodIntelligence'
import { getAgentResult, saveAgentResult, markGenerating, invalidateAgents } from './store'
import { Period } from '../date'

export async function regenerateHealthIntelligence(period: Period = 'month', opts: { force?: boolean } = {}): Promise<Record<string, any>> {
  await markGenerating('A3', period)
  try {
    if (opts.force) {
      // Manual "Refresh" — bypass the specialist cache for this period so
      // it's a genuinely fresh run, not a reuse of a prior success.
      await invalidateAgents(SPECIALIST_AGENT_IDS)
    }

    // Prefer the stored A1 result (period-independent) — avoids a
    // redundant Gemini call when this was triggered right after A1 itself
    // regenerated. Falls back to a live blood analysis only if nothing
    // has been stored yet.
    const storedBlood = await getAgentResult('A1', 'all')
    const bloodResult = storedBlood?.result ?? (await analyzeBloodIntelligence())

    const board = await runSpecialistBoard(bloodResult, period)
    const anyBoardData = Object.values(board).some((s: any) => s.has_data)

    if (!bloodResult.has_data && !anyBoardData) {
      const result = {
        agent_id: 'A3',
        period,
        has_data: false,
        summary: 'Not enough data yet for the specialist board to weigh in. Upload a blood report and log a few check-ins to unlock this.',
        board,
      }
      await saveAgentResult('A3', result, { period, version: HEALTH_INTELLIGENCE_VERSION })
      return result
    }

    const consolidated = await callGeminiAgent<Record<string, any>>({
      agentId: 'A3',
      promptVersion: HEALTH_INTELLIGENCE_VERSION,
      systemPrompt: HEALTH_INTELLIGENCE_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `Consolidate these five independent specialist reviews for the period: ${period.replace('_', ' ')}. Each specialist reviewed the data separately and did not see the others' notes.

Physician:
${JSON.stringify(board.physician, null, 2)}

Dermatologist:
${JSON.stringify(board.dermatologist, null, 2)}

Psychologist:
${JSON.stringify(board.psychologist, null, 2)}

Gut Microbiome Doctor:
${JSON.stringify(board.gutMicrobiomeDoctor, null, 2)}

TCM Practitioner:
${JSON.stringify(board.tcmPractitioner, null, 2)}

Run the case conference and produce the consolidated output described in your instructions.`,
        },
      ],
      temperature: 0.4,
      maxOutputTokens: 8192,
    })

    const result = { ...consolidated, period, board, has_data: true }
    await saveAgentResult('A3', result, { period, version: HEALTH_INTELLIGENCE_VERSION })
    return result
  } catch (err) {
    console.error('[A3] regenerate failed:', err)
    await saveAgentResult('A3', {}, { period, version: HEALTH_INTELLIGENCE_VERSION, status: 'error', error: String(err) })
    throw err
  }
}

export async function getStoredHealthIntelligence(period: Period = 'month') {
  return getAgentResult('A3', period)
}