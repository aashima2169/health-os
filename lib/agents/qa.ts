// lib/agents/qa.ts
// Stores questions specialists ask (questions_for_this_specialty) and the
// person's own answers to them. Answers are fed back into that specialist's
// next run as self-reported context — this is what closes the loop asked
// for: "some of those questions can be redirected to the user."
//
// Server-only — `client` is required (request-scoped, from
// lib/supabaseServer.ts).
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SpecialistQA {
  id: string
  agent_id: string
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

// Called after a specialist successfully runs — replaces its unanswered
// questions with the new batch (capped to 2, matching the prompt's own
// cap, but enforced here too so a model that ignores the instruction
// can't flood the list). Answered questions are left untouched — their
// value persists even if the specialist's newer run didn't re-ask them.
// This fixes questions piling up indefinitely: previously each run's
// slightly different wording created a new row instead of matching an
// existing one, so the same underlying question (e.g. hair/nail symptoms)
// could appear 5-6 times across runs.
export async function upsertQuestions(client: SupabaseClient, agentId: string, questions: string[]) {
  if (!questions || questions.length === 0) return
  const capped = questions
    .filter((q) => typeof q === 'string' && q.trim().length > 0)
    .slice(0, 2)
  if (capped.length === 0) return

  // Remove this agent's previously-asked-but-never-answered questions —
  // they're being superseded by this run's batch. Answered ones stay.
  const { error: deleteError } = await client
    .from('specialist_qa')
    .delete()
    .eq('agent_id', agentId)
    .is('answer', null)
  if (deleteError) console.error(`[qa] cleanup for ${agentId} failed:`, deleteError)

  const rows = capped.map((q) => ({ agent_id: agentId, question: q.trim() }))
  const { error } = await client
    .from('specialist_qa')
    .upsert(rows, { onConflict: 'user_id,agent_id,question', ignoreDuplicates: true })

  if (error) console.error(`[qa] upsertQuestions(${agentId}) error:`, error)
}

// All questions for one specialist (answered or not) — used to feed
// previously-answered ones back in as context on the next run.
export async function getQuestionsForAgent(client: SupabaseClient, agentId: string): Promise<SpecialistQA[]> {
  const { data, error } = await client
    .from('specialist_qa')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[qa] getQuestionsForAgent(${agentId}) error:`, error)
    return []
  }
  return data ?? []
}

// All questions across every specialist — used by the Insights page's
// "Questions For You" section.
export async function getAllQuestions(client: SupabaseClient): Promise<SpecialistQA[]> {
  const { data, error } = await client
    .from('specialist_qa')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[qa] getAllQuestions error:', error)
    return []
  }
  return data ?? []
}

export async function saveAnswer(client: SupabaseClient, agentId: string, question: string, answer: string) {
  const { error } = await client
    .from('specialist_qa')
    .upsert(
      { agent_id: agentId, question: question.trim(), answer, answered_at: new Date().toISOString() },
      { onConflict: 'user_id,agent_id,question' },
    )
  if (error) console.error(`[qa] saveAnswer(${agentId}) error:`, error)
}
