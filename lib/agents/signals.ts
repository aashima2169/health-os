// lib/agents/signals.ts
// Signals — the patient-facing synthesis layer, and the primary cross-
// domain reasoning surface. v2: the pattern-mining itself now happens
// deterministically (lib/agents/flarePatterns.ts computes flare windows
// and weighted candidate factors — zero tokens), and the LLM's job is
// narrowed to interpreting and writing up the strongest few, from a small
// pre-digested input instead of a raw multi-domain dump. Evidence sources:
// getFullHistory + blood + photos (raw, direct), profile/conditions/
// medications (static context), weather/air-quality via Open-Meteo keyed
// off profile.city (optional), and the specialist board (secondary,
// trimmed, never required). This is the ONLY place this file reads
// A1/A3a-f output: if the board is ever restructured, only this adapter
// changes.
import type { SupabaseClient } from '@supabase/supabase-js'
import { callGeminiAgent } from './gemini'
import { SIGNALS_PROMPT, SIGNALS_VERSION } from './prompts'
import { getAgentResult, saveAgentResult, claimGenerating } from './store'
import { getSpecialistBoardSnapshot, fetchWeeklyPhotoParts } from './specialistBoard'
import { getStoredBloodIntelligence } from './bloodIntelligence'
import { getActiveSignals, reconcileSignals } from './signalsStore'
import { buildFlareWindows, computeCandidatePatterns, WINDOW_DAYS_BEFORE } from './flarePatterns'
import { logSignalPatterns } from './signalPatternLog'
import { getFullHistory, getProfile, getConditions, getAllMedications, getAllBloodReports } from '../db'
import { getEnvironmentByDate } from '../weather'
import { Period, daysForPeriod, todayISO, addDays } from '../date'
import { SignalHypothesis } from '../../types/signals'

type History = Awaited<ReturnType<typeof getFullHistory>>

function asRead(row: { status: string; result: Record<string, any> } | null) {
  return row && row.status === 'success' ? row.result : null
}

// A1 tags every marker with a status ('normal' | 'borderline_low' | 'low' |
// 'borderline_high' | 'high'). Normal markers add little to cross-domain
// correlation and are the bulk of the token cost of including blood data
// at all, so only markers outside their reference range are kept — a
// system left with zero abnormal markers is dropped entirely.
function abnormalMarkersOnly(blood: Record<string, any> | null) {
  if (!blood || !Array.isArray(blood.by_system)) return blood

  const by_system = blood.by_system
    .map((system: any) => ({
      ...system,
      markers: Array.isArray(system.markers)
        ? system.markers.filter((m: any) => m.status && m.status !== 'normal')
        : system.markers,
    }))
    .filter((system: any) => Array.isArray(system.markers) && system.markers.length > 0)

  return { ...blood, by_system }
}

// Secondary evidence only — trimmed to the two fields actually worth a
// second opinion; the rest (data_reviewed, action_items, confidence_note)
// is why domain_reads used to be the single biggest token cost after
// raw_evidence itself. TCM's tongue-specific fields are the exception:
// tongue_observed/tongue_findings/dampness_assessment carry physical-sign
// evidence (dampness, coating, swelling) nothing else in the pipeline
// captures, so they're kept even though they're domain-specific extras.
function trimDomainRead(read: Record<string, any> | null, keepTongueFields = false) {
  if (!read) return null
  const base = { summary: read.summary, key_findings: read.key_findings }
  if (!keepTongueFields) return base
  return {
    ...base,
    tongue_observed: read.tongue_observed,
    tongue_findings: read.tongue_findings,
    dampness_assessment: read.dampness_assessment,
  }
}

// Freshness/continuity beyond the flare windows, without re-sending the
// entire period's raw history.
function sliceRecent(history: History, days: number) {
  const cutoff = addDays(todayISO(), -days)
  return {
    daily_logs: history.logs.filter((l: any) => l.log_date >= cutoff),
    mental_states: history.mentalStates.filter((s: any) => s.log_date >= cutoff),
    meals: history.meals.filter((m: any) => m.log_date >= cutoff),
    exercise: history.exercise.filter((e: any) => e.log_date >= cutoff),
    recovery: history.recovery.filter((r: any) => r.log_date >= cutoff),
    supplements: history.supplements.filter((s: any) => s.log_date >= cutoff),
  }
}

function hasAnyEvidence(history: History, blood: { status: string } | null): boolean {
  return (
    history.logs.length > 0 ||
    history.meals.length > 0 ||
    history.healthEvents.length > 0 ||
    blood?.status === 'success'
  )
}

// Runs one Signals synthesis pass: mines deterministic flare-anchored
// patterns, gathers slim supporting context, asks Gemini for at most 3
// hypotheses, and reconciles them into the `signals` table. Coordinated
// via the same claim_agent_generation lock the rest of the pipeline uses,
// under a dedicated 'SIGNALS' agent_insights row (period 'all') that acts
// purely as a status/lock marker — the actual hypotheses live in `signals`.
export async function regenerateSignals(client: SupabaseClient, period: Period = 'month'): Promise<{ signals: SignalHypothesis[] }> {
  const won = await claimGenerating(client, 'SIGNALS', 'all')
  if (!won) return { signals: [] }

  try {
    const days = daysForPeriod(period)
    const periodEnd = todayISO()
    const periodStart = addDays(periodEnd, -days)
    const weatherStart = addDays(periodStart, -WINDOW_DAYS_BEFORE)

    const [history, blood, board, tonguePhotoParts, profile, conditions, medications, bloodReports, environmentByDate, existing] =
      await Promise.all([
        getFullHistory(days, client),
        getStoredBloodIntelligence(client),
        getSpecialistBoardSnapshot(client, period),
        fetchWeeklyPhotoParts(client, ['tongue']),
        getProfile(client),
        getConditions(client),
        getAllMedications(client),
        getAllBloodReports(client),
        getEnvironmentByDate(weatherStart, periodEnd),
        getActiveSignals(client),
      ])

    // Skin/flare photos only worth fetching (and paying image tokens for)
    // if something was actually logged this period to visually correlate —
    // no point attaching a stale photo when nothing flared.
    const skinPhotoParts = history.healthEvents.length > 0
      ? await fetchWeeklyPhotoParts(client, ['acne', 'flare'])
      : []

    if (!hasAnyEvidence(history, blood)) {
      await saveAgentResult(
        client,
        'SIGNALS',
        { has_data: false, message: 'Not enough data yet to identify patterns.' },
        { period: 'all', version: SIGNALS_VERSION },
      )
      return { signals: [] }
    }

    const flareWindows = buildFlareWindows(history.healthEvents, history, medications, environmentByDate, bloodReports)
    const candidatePatterns = computeCandidatePatterns(flareWindows, medications, history, environmentByDate, bloodReports, periodStart, periodEnd)

    // candidate_patterns above uses the FULL sample (flareWindows) — the
    // statistical weighting needs every occurrence. Only the verbose raw
    // flare_windows sent to the prompt gets capped, to the 5 most
    // significant (most severe, ties broken by most recent).
    const topFlareWindows = [...flareWindows]
      .sort((a, b) => (b.severity ?? -1) - (a.severity ?? -1) || b.startDate.localeCompare(a.startDate))
      .slice(0, 5)

    const flare_windows = topFlareWindows.map((w) => ({
      event_type: w.eventType,
      start_date: w.startDate,
      severity: w.severity,
      body_location: w.bodyLocation,
      meals: w.mealDescriptions,
      exercise: w.exerciseTypes,
      mental_states: w.mentalStates,
      humidity_pct: w.avgHumidity,
      temp_c: w.avgTemp,
      aqi: w.avgAqi,
      sleep_hours: w.avgSleepHours,
      shallow_breathing_days: w.shallowBreathingDays,
      outside_meal_count: w.outsideMealCount,
      outside_meal_reasons: w.outsideMealReasons,
      abnormal_markers_at_time: w.abnormalMarkersAtTime,
    }))

    const activeMedications = medications.filter((m) => !m.end_date || m.end_date >= periodEnd)
    const static_context = {
      profile: profile
        ? { gender: profile.gender, age: profile.age, city: profile.city, menstruating_status: profile.menstruating_status }
        : null,
      known_conditions: conditions.map((c) => ({ name: c.condition_name, diagnosed_date: c.diagnosed_date })),
      current_medications: activeMedications.map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
      blood_markers: abnormalMarkersOnly(asRead(blood)),
    }

    const recent_context = sliceRecent(history, 5)

    const domain_reads = {
      general_patterns: trimDomainRead(asRead(board.physician)),
      skin: trimDomainRead(asRead(board.dermatologist)),
      mood_and_stress: trimDomainRead(asRead(board.psychologist)),
      gut: trimDomainRead(asRead(board.gutMicrobiomeDoctor)),
      nutrition: trimDomainRead(asRead(board.nutritionist)),
      energy_patterns: trimDomainRead(asRead(board.tcmPractitioner), true),
    }

    const existingForPrompt = existing.map((s) => ({
      topic_key: s.topic_key,
      title: s.title,
      confidence: s.confidence,
      confidence_trend: s.confidence_trend,
      last_updated_at: s.last_updated_at,
    }))

    const photoParts = [...skinPhotoParts, ...tonguePhotoParts]

    const result = await callGeminiAgent<{ signals: SignalHypothesis[] }>({
      client,
      agentId: 'SIGNALS',
      promptVersion: SIGNALS_VERSION,
      systemPrompt: SIGNALS_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `candidate_patterns (PRIMARY — deterministic co-occurrence signal; weight = how much more often this shows up around flares than its own baseline rate; empty if fewer than 2 flares logged):\n${JSON.stringify(candidatePatterns, null, 2)}\n\nflare_windows (top ${topFlareWindows.length} of ${flareWindows.length} logged flares this period, by severity — what was happening in the ${WINDOW_DAYS_BEFORE} days before each; this is where diet/exercise/mental-state reasoning belongs, since those are too fuzzy to pre-quantify):\n${JSON.stringify(flare_windows, null, 2)}\n\nstatic_context:\n${JSON.stringify(static_context, null, 2)}\n\nrecent_context (last 5 days, for freshness/continuity beyond the flare windows):\n${JSON.stringify(recent_context, null, 2)}\n\ndomain_reads (secondary — prior expert reads, summary only, may be incomplete):\n${JSON.stringify(domain_reads, null, 2)}\n\nexisting_signals:\n${JSON.stringify(existingForPrompt, null, 2)}\n\n${photoParts.length > 0 ? `${photoParts.length} photo(s) are attached as images.` : 'No skin or tongue photos are available for this pass.'}\n\nIdentify at most 3 recurring patterns worth investigating, per your instructions.`,
        },
        ...photoParts,
      ],
      temperature: 0.4,
      maxOutputTokens: 4096,
    })

    const hypotheses = (Array.isArray(result.signals) ? result.signals : []).slice(0, 3)
    await reconcileSignals(hypotheses, client)
    await saveAgentResult(client, 'SIGNALS', { has_data: true, count: hypotheses.length }, { period: 'all', version: SIGNALS_VERSION })

    logSignalPatterns(client, period, flareWindows.length, candidatePatterns, hypotheses.map((h) => h.topic_key)).catch(() => {})

    return { signals: hypotheses }
  } catch (err) {
    console.error('[SIGNALS] regenerate failed:', err)
    await saveAgentResult(client, 'SIGNALS', {}, { period: 'all', version: SIGNALS_VERSION, status: 'error', error: String(err) })
    throw err
  }
}

export async function getSignalsStatus(client: SupabaseClient) {
  return getAgentResult(client, 'SIGNALS', 'all')
}
