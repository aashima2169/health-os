// lib/agents/signalPatternLog.ts
// Append-only history of what the deterministic layer (flarePatterns.ts)
// computed each Signals run, and which topic_keys the LLM actually
// surfaced from it — lets the weighting logic be evaluated/tuned later
// using real history instead of only ever seeing the latest pass. Mirrors
// lib/tokenLog.ts: fire-and-forget, never throws, never blocks the run
// it's logging.
//
// Server-only — `client` is required (request-scoped, from
// lib/supabaseServer.ts).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CandidatePattern } from './flarePatterns'
import type { Period } from '../date'

export async function logSignalPatterns(
  client: SupabaseClient,
  period: Period,
  flareCount: number,
  candidatePatterns: CandidatePattern[],
  surfacedTopicKeys: string[],
) {
  const { error } = await client.from('signal_pattern_log').insert({
    period,
    flare_count: flareCount,
    candidate_patterns: candidatePatterns,
    surfaced_topic_keys: surfacedTopicKeys,
  })
  if (error) console.error('[signalPatternLog] failed to log:', error)
}
