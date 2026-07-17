// lib/agents/signalsStore.ts
// Persistence for the `signals` table — distinct from store.ts's
// agent_insights table. Signals are persistent, evolving hypotheses keyed
// by topic_key, not a periodic (agent_id, period) snapshot that gets fully
// overwritten each run: a regeneration updates or extends existing rows
// rather than replacing them wholesale.
//
// Unlike most of lib/agents/*, this file is also called directly from a
// client component (app/signals/page.tsx, for immediate reads outside the
// API route) — so `client` is optional here, defaulting to the browser
// singleton, same pattern as lib/db.ts. Server callers (API routes) pass
// their request-scoped client explicitly.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { Signal, SignalHypothesis, ConfidenceHistoryEntry } from '../../types/signals'

export async function getActiveSignals(client: SupabaseClient = supabase): Promise<Signal[]> {
  const { data, error } = await client
    .from('signals')
    .select('*')
    .in('status', ['active', 'needs_more_data'])
    .order('confidence', { ascending: false })

  if (error) {
    console.error('[signalsStore] getActiveSignals error:', error)
    return []
  }
  return data ?? []
}

// Every signal regardless of status — for the history/accuracy view. The
// dataset is small (every hypothesis ever generated), so this is a single
// fetch with stats computed client-side rather than a separate aggregation
// query.
export async function getAllSignals(client: SupabaseClient = supabase): Promise<Signal[]> {
  const { data, error } = await client
    .from('signals')
    .select('*')
    .order('last_updated_at', { ascending: false })

  if (error) {
    console.error('[signalsStore] getAllSignals error:', error)
    return []
  }
  return data ?? []
}

// Reconciles a fresh pass of model-proposed hypotheses against what's
// already stored: a topic_key match is an update (appends to
// confidence_history, keeps first_generated_at, recomputes trend from the
// confidence delta), anything new is inserted. Existing signals not
// mentioned this pass are left untouched — silence on a topic isn't
// evidence it's gone, so we never auto-fade or delete one.
export async function reconcileSignals(hypotheses: SignalHypothesis[], client: SupabaseClient = supabase): Promise<void> {
  if (!hypotheses || hypotheses.length === 0) return

  const topicKeys = hypotheses.map((h) => h.topic_key)
  const { data: existingRows, error: fetchError } = await client
    .from('signals')
    .select('*')
    .in('topic_key', topicKeys)

  if (fetchError) {
    console.error('[signalsStore] reconcileSignals fetch error:', fetchError)
    return
  }
  const existingByKey = new Map<string, Signal>((existingRows ?? []).map((row: Signal) => [row.topic_key, row]))
  const now = new Date().toISOString()

  const upserts = hypotheses.map((h) => {
    const existing = existingByKey.get(h.topic_key)
    const historyEntry: ConfidenceHistoryEntry = { date: now, confidence: h.confidence, note: h.confidence_note }
    const confidence_history = existing ? [...existing.confidence_history, historyEntry] : [historyEntry]
    const confidence_trend = !existing
      ? 'new'
      : h.confidence > existing.confidence
        ? 'increasing'
        : h.confidence < existing.confidence
          ? 'decreasing'
          : 'stable'

    return {
      topic_key: h.topic_key,
      title: h.title,
      hypothesis: h.hypothesis,
      status: h.status,
      confidence: h.confidence,
      confidence_trend,
      suggested_experiment: h.suggested_experiment ?? null,
      contributing_factors: h.contributing_factors ?? [],
      contradictions: h.contradictions ?? [],
      missing_information: h.missing_information ?? [],
      possible_explanations: h.possible_explanations ?? [],
      confidence_history,
      first_generated_at: existing?.first_generated_at ?? now,
      last_updated_at: now,
    }
  })

  const { error } = await client.from('signals').upsert(upserts, { onConflict: 'user_id,topic_key' })
  if (error) console.error('[signalsStore] reconcileSignals upsert error:', error)
}

// User-driven only — the model is never allowed to set 'resolved' or
// 'dismissed' (see SIGNALS_PROMPT in prompts.ts). 'active' is also valid
// here for reopening a past decision from the history view.
export async function setSignalStatus(id: string, status: 'resolved' | 'dismissed' | 'active', client: SupabaseClient = supabase) {
  const { error } = await client
    .from('signals')
    .update({ status, last_updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) console.error(`[signalsStore] setSignalStatus(${id}, ${status}) error:`, error)
}
