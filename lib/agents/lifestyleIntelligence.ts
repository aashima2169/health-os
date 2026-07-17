// lib/agents/lifestyleIntelligence.ts
// A2: Lifestyle Intelligence — analyses diet, movement, sleep, mental
// state, recovery, and supplements ONLY, never blood. Now period-aware:
// one stored result per timeframe, so switching periods doesn't trigger
// a redundant regeneration if that period was already computed.
//
// Server-only — `client` is required (request-scoped, from
// lib/supabaseServer.ts), threaded through to every store/gemini call.
import type { SupabaseClient } from '@supabase/supabase-js'
import { getFullHistory } from '../db'
import { callGeminiAgent } from './gemini'
import { LIFESTYLE_INTELLIGENCE_PROMPT, LIFESTYLE_INTELLIGENCE_VERSION } from './prompts'
import { getAgentResult, saveAgentResult, claimGenerating, invalidateAgents } from './store'
import { regenerateHealthIntelligence } from './healthIntelligence'
import { SPECIALIST_AGENT_IDS } from './specialistBoard'
import { Period, daysForPeriod } from '../date'

export async function analyzeLifestyleIntelligence(client: SupabaseClient, period: Period = 'month'): Promise<Record<string, any>> {
  const days = daysForPeriod(period)
  const history = await getFullHistory(days, client)

  if (history.logs.length < 3) {
    return {
      agent_id: 'A2',
      prompt_version: LIFESTYLE_INTELLIGENCE_VERSION,
      has_data: false,
      data_gaps: ['Not enough check-ins logged in this window'],
      weekly_summary: 'Not enough data yet — keep logging check-ins to unlock lifestyle patterns.',
      behaviour_patterns: [],
      recovery_patterns: [],
      potential_trigger_patterns: [],
      adherence_summary: 'Insufficient data.',
      confidence: 0,
    }
  }

  const result = await callGeminiAgent<Record<string, any>>({
    client,
    agentId: 'A2',
    promptVersion: LIFESTYLE_INTELLIGENCE_VERSION,
    systemPrompt: LIFESTYLE_INTELLIGENCE_PROMPT,
    userParts: [
      {
        type: 'text',
        text: `Analyse this lifestyle data for the period: ${period.replace('_', ' ')} (last ${days} days).\n\nData:\n${JSON.stringify(history, null, 2)}`,
      },
    ],
    temperature: 0.3,
    maxOutputTokens: 4096,
  })

  return { ...result, has_data: true, period, days_analyzed: days }
}

// Runs A2 for the given period, persists it under that period, then
// cascades to regenerate A3 for the SAME period. Marks 'generating'
// immediately so a concurrent poll sees progress and a second trigger
// doesn't fire redundantly while this one is in flight.
export async function regenerateLifestyleIntelligence(client: SupabaseClient, period: Period = 'month'): Promise<Record<string, any>> {
  const won = await claimGenerating(client, 'A2', period)
  if (!won) {
    const stored = await getAgentResult(client, 'A2', period)
    return stored?.result ?? { agent_id: 'A2', period, has_data: false, status: 'generating' }
  }

  try {
    const result = await analyzeLifestyleIntelligence(client, period)
    await saveAgentResult(client, 'A2', result, { period, version: LIFESTYLE_INTELLIGENCE_VERSION })

    // A new check-in shifts every rolling window (week/month/quarter/etc),
    // not just the period this call was triggered with — so every
    // specialist's cached read, across every period, is now stale.
    await invalidateAgents(client, SPECIALIST_AGENT_IDS)

    regenerateHealthIntelligence(client, period).catch((err) =>
      console.error('[A2 -> A3 cascade] failed:', err),
    )

    return result
  } catch (err) {
    console.error('[A2] regenerate failed:', err)
    await saveAgentResult(client, 'A2', {}, { period, version: LIFESTYLE_INTELLIGENCE_VERSION, status: 'error', error: String(err) })
    throw err
  }
}

export async function getStoredLifestyleIntelligence(client: SupabaseClient, period: Period = 'month') {
  return getAgentResult(client, 'A2', period)
}
