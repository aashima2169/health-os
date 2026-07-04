// lib/agents/qa.ts
// Stores questions specialists ask (questions_for_this_specialty) and the
// person's own answers to them. Answers are fed back into that specialist's
// next run as self-reported context — this is what closes the loop asked
// for: "some of those questions can be redirected to the user."
import { supabase } from '../supabase'

export interface SpecialistQA {
  id: string
  agent_id: string
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

// Called after a specialist successfully runs — upserts each new question
// it asked. Uses ignoreDuplicates so an existing (agent_id, question) row
// (and any answer already given) is left untouched.
export async function upsertQuestions(agentId: string, questions: string[]) {
  if (!questions || questions.length === 0) return
  const rows = questions
    .filter((q) => typeof q === 'string' && q.trim().length > 0)
    .map((q) => ({ agent_id: agentId, question: q.trim() }))
  if (rows.length === 0) return

  const { error } = await supabase
    .from('specialist_qa')
    .upsert(rows, { onConflict: 'agent_id,question', ignoreDuplicates: true })

  if (error) console.error(`[qa] upsertQuestions(${agentId}) error:`, error)
}

// All questions for one specialist (answered or not) — used to feed
// previously-answered ones back in as context on the next run.
export async function getQuestionsForAgent(agentId: string): Promise<SpecialistQA[]> {
  const { data, error } = await supabase
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
export async function getAllQuestions(): Promise<SpecialistQA[]> {
  const { data, error } = await supabase
    .from('specialist_qa')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[qa] getAllQuestions error:', error)
    return []
  }
  return data ?? []
}

export async function saveAnswer(agentId: string, question: string, answer: string) {
  const { error } = await supabase
    .from('specialist_qa')
    .upsert(
      { agent_id: agentId, question: question.trim(), answer, answered_at: new Date().toISOString() },
      { onConflict: 'agent_id,question' },
    )
  if (error) console.error(`[qa] saveAnswer(${agentId}) error:`, error)
}