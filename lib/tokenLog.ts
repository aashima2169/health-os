// lib/tokenLog.ts
// Per-call token usage logging, across every Gemini call site in the app —
// the shared agent pipeline (lib/agents/gemini.ts) and the standalone
// extraction functions that bypass it (lib/extractMarkers.ts,
// lib/extractPrescription.ts). Fire-and-forget: a logging failure must
// never break the actual agent call it's logging, so this never throws.
//
// Server-only — `client` is required (request-scoped, from
// lib/supabaseServer.ts).
import type { SupabaseClient } from '@supabase/supabase-js'

export interface GeminiUsage {
  input: number
  output: number
  tool?: number
  total: number
}

export async function logGeminiCall(client: SupabaseClient, callSite: string, usage: GeminiUsage, latencyMs: number) {
  const { error } = await client.from('gemini_call_log').insert({
    call_site: callSite,
    input_tokens: usage.input,
    output_tokens: usage.output,
    tool_tokens: usage.tool ?? 0,
    total_tokens: usage.total,
    latency_ms: latencyMs,
  })
  if (error) console.error(`[tokenLog] failed to log ${callSite}:`, error)
}
