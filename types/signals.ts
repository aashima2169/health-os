// types/signals.ts
// Mirrors the `signals` table in supabase/schema.sql exactly.
export type SignalStatus = 'active' | 'resolved' | 'needs_more_data' | 'dismissed'
export type ConfidenceTrend = 'increasing' | 'decreasing' | 'stable' | 'new'

export interface ContributingFactor {
  factor: string
  evidence_summary: string
  source_specialists: string[]
}

export interface Contradiction {
  description: string
  specialists_involved: string[]
}

export interface MissingInformation {
  what: string
  why_it_would_help: string
}

export interface ConfidenceHistoryEntry {
  date: string
  confidence: number
  note?: string
}

// Competing causal explanations for the same observed pattern — never just
// one, per Signals' "generate competing hypotheses" reasoning principle.
export interface PossibleExplanation {
  explanation: string
  note: string
}

// A persisted row in the `signals` table.
export interface Signal {
  id: string
  title: string
  hypothesis: string
  status: SignalStatus
  confidence: number
  confidence_trend: ConfidenceTrend | null
  suggested_experiment: string | null
  contributing_factors: ContributingFactor[]
  contradictions: Contradiction[]
  missing_information: MissingInformation[]
  confidence_history: ConfidenceHistoryEntry[]
  possible_explanations: PossibleExplanation[]
  first_generated_at: string
  last_updated_at: string
  topic_key: string
}

// What the model returns per pattern, before reconciliation against
// existing rows assigns first_generated_at/confidence_history/etc.
export interface SignalHypothesis {
  topic_key: string
  title: string
  hypothesis: string
  confidence: number
  confidence_note?: string
  status: 'active' | 'needs_more_data'
  suggested_experiment?: string | null
  contributing_factors: ContributingFactor[]
  contradictions: Contradiction[]
  missing_information: MissingInformation[]
  possible_explanations: PossibleExplanation[]
}
