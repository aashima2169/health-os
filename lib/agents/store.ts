// lib/agents/store.ts
// Reads and writes the latest stored result per (agent_id, period). Also
// supports a 'generating' status so routes can mark a background job as
// in-flight and the frontend can poll and show a loader instead of a
// blank screen.
import { supabase } from '../supabase'

export type AgentId = 'A1' | 'A2' | 'A3' | 'A3a' | 'A3b' | 'A3c' | 'A3d' | 'A3e' | 'A3f'
export type AgentStatus = 'success' | 'error' | 'generating'

export interface AgentInsightRow {
  agent_id: AgentId
  period: string
  version: string | null
  result: Record<string, any>
  status: AgentStatus
  error: string | null
  generated_at: string
}

export async function getAgentResult(agentId: AgentId, period = 'all'): Promise<AgentInsightRow | null> {
  const { data, error } = await supabase
    .from('agent_insights')
    .select('*')
    .eq('agent_id', agentId)
    .eq('period', period)
    .maybeSingle()

  if (error) {
    console.error(`[store] getAgentResult(${agentId}, ${period}) error:`, error)
    return null
  }
  return data
}

export async function saveAgentResult(
  agentId: AgentId,
  result: Record<string, any>,
  opts: { period?: string; version?: string; status?: AgentStatus; error?: string } = {},
) {
  const { error } = await supabase
    .from('agent_insights')
    .upsert(
      {
        agent_id: agentId,
        period: opts.period ?? 'all',
        version: opts.version ?? null,
        result,
        status: opts.status ?? 'success',
        error: opts.error ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'agent_id,period' },
    )

  if (error) console.error(`[store] saveAgentResult(${agentId}, ${opts.period ?? 'all'}) error:`, error)
}

// Marks a row as 'generating' immediately, before the actual Gemini work
// starts — so a concurrent page load or poll sees "in progress" rather
// than nothing, and doesn't trigger a second redundant regeneration.
export async function markGenerating(agentId: AgentId, period = 'all') {
  await saveAgentResult(agentId, {}, { period, status: 'generating' })
}

// Deletes stored results for the given agents across ALL periods. Used
// when underlying data changes (new blood report, new check-in) — the
// specialist board's cached reads are no longer valid for any timeframe,
// since they may have consumed the data that just changed. Without this,
// a specialist that succeeded before a new check-in would keep getting
// reused forever, showing stale analysis.
export async function invalidateAgents(agentIds: AgentId[]) {
  const { error } = await supabase.from('agent_insights').delete().in('agent_id', agentIds)
  if (error) console.error(`[store] invalidateAgents(${agentIds.join(',')}) error:`, error)
}

// Deletes a single (agent, period) row — used for a forced manual refresh
// of one specific timeframe without nuking every other period's cache.
export async function invalidateAgentPeriod(agentId: AgentId, period: string) {
  const { error } = await supabase.from('agent_insights').delete().eq('agent_id', agentId).eq('period', period)
  if (error) console.error(`[store] invalidateAgentPeriod(${agentId}, ${period}) error:`, error)
}