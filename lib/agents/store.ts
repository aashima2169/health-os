// lib/agents/store.ts
// Reads and writes the latest stored result per (agent_id, period). Also
// supports a 'generating' status so routes can mark a background job as
// in-flight and the frontend can poll and show a loader instead of a
// blank screen.
//
// This module only ever runs server-side, so `client` is a required
// parameter (a request-scoped client from lib/supabaseServer.ts) — there's
// no safe default here the way lib/db.ts has for browser callers.
import type { SupabaseClient } from '@supabase/supabase-js'

export type AgentId = 'A1' | 'A2' | 'A3' | 'A3a' | 'A3b' | 'A3c' | 'A3d' | 'A3e' | 'A3f' | 'SIGNALS'
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

export async function getAgentResult(client: SupabaseClient, agentId: AgentId, period = 'all'): Promise<AgentInsightRow | null> {
  const { data, error } = await client
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
  client: SupabaseClient,
  agentId: AgentId,
  result: Record<string, any>,
  opts: { period?: string; version?: string; status?: AgentStatus; error?: string } = {},
) {
  const { error } = await client
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
      { onConflict: 'user_id,agent_id,period' },
    )

  if (error) console.error(`[store] saveAgentResult(${agentId}, ${opts.period ?? 'all'}) error:`, error)
}

// Marks a row as 'generating' immediately, before the actual Gemini work
// starts — so a concurrent page load or poll sees "in progress" rather
// than nothing, and doesn't trigger a second redundant regeneration.
export async function markGenerating(client: SupabaseClient, agentId: AgentId, period = 'all') {
  await saveAgentResult(client, agentId, {}, { period, status: 'generating' })
}

// Atomically claims the right to regenerate (agentId, period). Returns
// true if this call won the claim and should proceed; false if another
// invocation already holds an active claim (staleSeconds controls how
// long a claim is considered "active" before it's treated as abandoned —
// e.g. from a crashed invocation — and reclaimable).
//
// This REPLACES in-memory locking (a JS Map/variable), which does not
// work across Vercel serverless invocations — each invocation is an
// isolated process with no shared memory, so two concurrent requests
// could each think they're the only one running and race each other,
// with whichever finishes last overwriting the other's result even if
// that one failed. This uses a single atomic SQL statement instead
// (INSERT ... ON CONFLICT DO UPDATE ... WHERE), which Postgres guarantees
// only one concurrent caller can win, regardless of process boundaries.
export async function claimGenerating(client: SupabaseClient, agentId: AgentId, period = 'all', staleSeconds = 360): Promise<boolean> {
  const { data, error } = await client.rpc('claim_agent_generation', {
    p_agent_id: agentId,
    p_period: period,
    p_stale_seconds: staleSeconds,
  })
  if (error) {
    console.error(`[store] claimGenerating(${agentId}, ${period}) error:`, error)
    return false
  }
  return data === true
}

// Deletes stored results for the given agents across ALL periods. Used
// when underlying data changes (new blood report, new check-in) — the
// specialist board's cached reads are no longer valid for any timeframe,
// since they may have consumed the data that just changed. Without this,
// a specialist that succeeded before a new check-in would keep getting
// reused forever, showing stale analysis.
export async function invalidateAgents(client: SupabaseClient, agentIds: AgentId[]) {
  const { error } = await client.from('agent_insights').delete().in('agent_id', agentIds)
  if (error) console.error(`[store] invalidateAgents(${agentIds.join(',')}) error:`, error)
}

// Deletes a single (agent, period) row — used for a forced manual refresh
// of one specific timeframe without nuking every other period's cache.
export async function invalidateAgentPeriod(client: SupabaseClient, agentId: AgentId, period: string) {
  const { error } = await client.from('agent_insights').delete().eq('agent_id', agentId).eq('period', period)
  if (error) console.error(`[store] invalidateAgentPeriod(${agentId}, ${period}) error:`, error)
}
