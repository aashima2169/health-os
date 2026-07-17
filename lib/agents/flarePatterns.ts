// lib/agents/flarePatterns.ts
// Deterministic "weightage" engine for Signals — the actual pattern-mining
// happens here in plain TypeScript, not via the LLM. For each logged flare
// (health_event), builds a short window of what was happening around it,
// then computes how much more often each cleanly-quantifiable factor
// (medication/supplement active, menstruating, weather thresholds, sleep,
// breathing, eating outside, abnormal blood markers) shows up in flare
// windows versus its own baseline rate across the whole period — that
// delta ("lift") is its weight. Diet content/exercise/mental-state stay as
// short raw text per window since they're too fuzzy to cleanly quantify
// this way; that reasoning stays the LLM's job.
import type { HealthEvent, Medication, BloodReport } from '../../types'
import { addDays, daysBetween } from '../date'
import { getFullHistory } from '../db'
import type { DailyEnvironment } from '../weather'

type History = Awaited<ReturnType<typeof getFullHistory>>

export const WINDOW_DAYS_BEFORE = 5

export interface FlareWindow {
  eventId: string
  eventType: string
  startDate: string
  severity: number | null
  bodyLocation: string | null
  windowStart: string
  windowEnd: string
  mealDescriptions: string[]
  exerciseTypes: string[]
  mentalStates: string[]
  supplementsTaken: string[]
  activeMedications: string[]
  wasMenstruating: boolean
  avgHumidity: number | null
  avgTemp: number | null
  avgAqi: number | null
  avgSleepHours: number | null
  shallowBreathingDays: number
  outsideMealCount: number
  outsideMealReasons: string[]
  abnormalMarkersAtTime: string[]
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  let cur = start
  let guard = 0
  while (cur <= end && guard < 90) {
    dates.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return dates
}

function medicationActiveDuring(m: Medication, windowStart: string, windowEnd: string): boolean {
  if (!m.start_date) return false
  const end = m.end_date ?? windowEnd // ongoing -> treat as covering through the window
  return m.start_date <= windowEnd && end >= windowStart
}

function wasMenstruatingDuring(periods: History['periods'], windowStart: string, windowEnd: string): boolean {
  return periods.some((p: any) => {
    const end = p.end_date ?? windowEnd
    return p.start_date <= windowEnd && end >= windowStart
  })
}

// Parses the reference-range formats actually present in blood_reports
// markers ("12.0 - 17.0", "< 5.7", "> 40"). Anything else (e.g. "Negative",
// unstructured text) returns null and is skipped — never guessed.
function parseReferenceRange(reference: string | undefined): { min: number | null; max: number | null } | null {
  if (!reference) return null
  const rangeMatch = reference.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/)
  if (rangeMatch) return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) }
  const lessMatch = reference.match(/^<\s*(-?\d+(?:\.\d+)?)/)
  if (lessMatch) return { min: null, max: parseFloat(lessMatch[1]) }
  const moreMatch = reference.match(/^>\s*(-?\d+(?:\.\d+)?)/)
  if (moreMatch) return { min: parseFloat(moreMatch[1]), max: null }
  return null
}

function isMarkerAbnormal(value: number, reference: string | undefined): boolean | null {
  const range = parseReferenceRange(reference)
  if (!range) return null
  if (range.min != null && value < range.min) return true
  if (range.max != null && value > range.max) return true
  return false
}

const BLOOD_REPORT_LOOKBACK_DAYS = 60

// The most recent report on or before `date`, as long as it's not so old
// it no longer reflects the person's actual state that day.
function nearestPriorBloodReport(bloodReports: BloodReport[], date: string): BloodReport | null {
  const prior = bloodReports
    .filter((r) => r.report_date <= date)
    .sort((a, b) => b.report_date.localeCompare(a.report_date))[0]
  if (!prior) return null
  if (daysBetween(prior.report_date, date) > BLOOD_REPORT_LOOKBACK_DAYS) return null
  return prior
}

// Which markers were outside their reference range as of the nearest
// blood report on or before `date` — this is what makes "marker X
// abnormal at time of flare" a per-day boolean, the same shape every
// other candidate factor here already is.
function abnormalMarkersOnDate(bloodReports: BloodReport[], date: string): string[] {
  const report = nearestPriorBloodReport(bloodReports, date)
  if (!report?.markers) return []
  return Object.entries(report.markers)
    .filter(([, m]) => isMarkerAbnormal(m.value, m.reference) === true)
    .map(([name]) => name)
}

export function buildFlareWindows(
  healthEvents: HealthEvent[],
  history: History,
  medications: Medication[],
  environmentByDate: Record<string, DailyEnvironment>,
  bloodReports: BloodReport[],
): FlareWindow[] {
  const avg = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v != null)
    return nums.length > 0 ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null
  }

  return healthEvents.map((event) => {
    const windowStart = addDays(event.start_date, -WINDOW_DAYS_BEFORE)
    const windowEnd = event.start_date
    const inWindow = (date: string) => date >= windowStart && date <= windowEnd

    const logsInWindow = history.logs.filter((l: any) => inWindow(l.log_date))

    const mealsInWindow = history.meals.filter((m: any) => inWindow(m.log_date))
    const mealDescriptions = mealsInWindow
      .filter((m: any) => m.description)
      .map((m: any) => m.description as string)
    const outsideMeals = mealsInWindow.filter((m: any) => m.location === 'outside')

    const exerciseTypes = Array.from(new Set(
      history.exercise.filter((e: any) => inWindow(e.log_date)).map((e: any) => e.exercise_type)
    )) as string[]

    const mentalStates = Array.from(new Set(
      history.mentalStates.filter((s: any) => inWindow(s.log_date)).map((s: any) => s.state)
    )) as string[]

    const supplementsTaken = Array.from(new Set(
      history.supplements.filter((s: any) => inWindow(s.log_date)).map((s: any) => s.supplement)
    )) as string[]

    const activeMedications = medications
      .filter((m) => medicationActiveDuring(m, windowStart, windowEnd))
      .map((m) => m.name)

    const wasMenstruating = wasMenstruatingDuring(history.periods, windowStart, windowEnd)

    const envInWindow = datesInRange(windowStart, windowEnd)
      .map((d) => environmentByDate[d])
      .filter((e): e is DailyEnvironment => !!e)

    return {
      eventId: event.id,
      eventType: event.event_type,
      startDate: event.start_date,
      severity: event.severity,
      bodyLocation: event.body_location,
      windowStart,
      windowEnd,
      mealDescriptions,
      exerciseTypes,
      mentalStates,
      supplementsTaken,
      activeMedications,
      wasMenstruating,
      avgHumidity: avg(envInWindow.map((e) => e.humidityPct)),
      avgTemp: avg(envInWindow.map((e) => e.tempMaxC)),
      avgAqi: avg(envInWindow.map((e) => e.usAqi)),
      avgSleepHours: avg(logsInWindow.map((l: any) => l.sleep_hours ?? null)),
      shallowBreathingDays: logsInWindow.filter((l: any) => l.breathing === 'shallow').length,
      outsideMealCount: outsideMeals.length,
      outsideMealReasons: Array.from(new Set(
        outsideMeals.filter((m: any) => m.outside_reason).map((m: any) => m.outside_reason as string)
      )),
      abnormalMarkersAtTime: abnormalMarkersOnDate(bloodReports, windowEnd),
    }
  })
}

export interface CandidatePattern {
  factor: string
  category: 'medication' | 'supplement' | 'weather' | 'cycle' | 'sleep' | 'breathing' | 'diet' | 'blood_marker' | 'mental_state' | 'exercise'
  present_in_flares: number
  of_flares: number
  baseline_rate: number | null
  weight: number
}

const HUMIDITY_HIGH_THRESHOLD = 70
const AQI_UNHEALTHY_THRESHOLD = 100
const LOW_SLEEP_THRESHOLD_HOURS = 6
const MIN_WEIGHT_TO_SURFACE = 0.15
const MAX_CANDIDATES = 8

// How often a boolean condition holds across the FULL period (all days
// with data) — the baseline a flare-window rate gets compared against.
// The gap between the two (not raw frequency alone) is what makes a
// factor worth surfacing: "ate rice" isn't a pattern if rice is eaten
// daily regardless of flares.
function computeBaselineRate(allDates: string[], predicate: (date: string) => boolean): number | null {
  if (allDates.length === 0) return null
  const trueCount = allDates.filter(predicate).length
  return Math.round((trueCount / allDates.length) * 100) / 100
}

// "Lift": how much more often a factor shows up in flare windows than its
// own baseline. Clamped to [0,1]. With no baseline to compare against, the
// flare-window rate itself is used, capped at 0.9 since there's nothing
// confirming it isn't just generally common.
function computeWeight(flareRate: number, baselineRate: number | null): number {
  if (baselineRate == null) return Math.min(flareRate, 0.9)
  return Math.max(0, Math.min(1, flareRate - baselineRate))
}

// Needs at least 2 flares for "recurring" to mean anything — with 0-1
// flares this returns [], and Signals falls back to flare_windows +
// static/recent context instead (see lib/agents/signals.ts).
export function computeCandidatePatterns(
  windows: FlareWindow[],
  medications: Medication[],
  history: History,
  environmentByDate: Record<string, DailyEnvironment>,
  bloodReports: BloodReport[],
  periodStart: string,
  periodEnd: string,
): CandidatePattern[] {
  if (windows.length < 2) return []

  const allDates = datesInRange(periodStart, periodEnd)
  const candidates: CandidatePattern[] = []

  const allMedNames = Array.from(new Set(medications.map((m) => m.name)))
  for (const name of allMedNames) {
    const med = medications.find((m) => m.name === name)
    if (!med) continue
    const presentCount = windows.filter((w) => w.activeMedications.includes(name)).length
    if (presentCount === 0) continue
    const baseline = computeBaselineRate(allDates, (d) => medicationActiveDuring(med, d, d))
    candidates.push({
      factor: `${name} active`,
      category: 'medication',
      present_in_flares: presentCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(presentCount / windows.length, baseline),
    })
  }

  const allSupplements = Array.from(new Set(history.supplements.map((s: any) => s.supplement))) as string[]
  for (const supplement of allSupplements) {
    const presentCount = windows.filter((w) => w.supplementsTaken.includes(supplement)).length
    if (presentCount === 0) continue
    const baseline = computeBaselineRate(allDates, (d) =>
      history.supplements.some((s: any) => s.log_date === d && s.supplement === supplement)
    )
    candidates.push({
      factor: `${supplement} taken`,
      category: 'supplement',
      present_in_flares: presentCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(presentCount / windows.length, baseline),
    })
  }

  const highHumidityCount = windows.filter((w) => w.avgHumidity != null && w.avgHumidity >= HUMIDITY_HIGH_THRESHOLD).length
  if (highHumidityCount > 0) {
    const baseline = computeBaselineRate(allDates, (d) => (environmentByDate[d]?.humidityPct ?? -1) >= HUMIDITY_HIGH_THRESHOLD)
    candidates.push({
      factor: `Humidity ≥ ${HUMIDITY_HIGH_THRESHOLD}%`,
      category: 'weather',
      present_in_flares: highHumidityCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(highHumidityCount / windows.length, baseline),
    })
  }

  const highAqiCount = windows.filter((w) => w.avgAqi != null && w.avgAqi >= AQI_UNHEALTHY_THRESHOLD).length
  if (highAqiCount > 0) {
    const baseline = computeBaselineRate(allDates, (d) => (environmentByDate[d]?.usAqi ?? -1) >= AQI_UNHEALTHY_THRESHOLD)
    candidates.push({
      factor: `Air quality unhealthy (AQI ≥ ${AQI_UNHEALTHY_THRESHOLD})`,
      category: 'weather',
      present_in_flares: highAqiCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(highAqiCount / windows.length, baseline),
    })
  }

  const menstruatingCount = windows.filter((w) => w.wasMenstruating).length
  if (menstruatingCount > 0) {
    const baseline = computeBaselineRate(allDates, (d) =>
      history.periods.some((p: any) => p.start_date <= d && (p.end_date ?? d) >= d)
    )
    candidates.push({
      factor: 'Menstruating during window',
      category: 'cycle',
      present_in_flares: menstruatingCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(menstruatingCount / windows.length, baseline),
    })
  }

  const lowSleepCount = windows.filter((w) => w.avgSleepHours != null && w.avgSleepHours < LOW_SLEEP_THRESHOLD_HOURS).length
  if (lowSleepCount > 0) {
    const sleepByDate = new Map(history.logs.map((l: any) => [l.log_date, l.sleep_hours]))
    const baseline = computeBaselineRate(allDates, (d) => {
      const hrs = sleepByDate.get(d)
      return hrs != null && hrs < LOW_SLEEP_THRESHOLD_HOURS
    })
    candidates.push({
      factor: `Low sleep (< ${LOW_SLEEP_THRESHOLD_HOURS}hrs)`,
      category: 'sleep',
      present_in_flares: lowSleepCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(lowSleepCount / windows.length, baseline),
    })
  }

  const shallowBreathingCount = windows.filter((w) => w.shallowBreathingDays > 0).length
  if (shallowBreathingCount > 0) {
    const baseline = computeBaselineRate(allDates, (d) =>
      history.logs.some((l: any) => l.log_date === d && l.breathing === 'shallow')
    )
    candidates.push({
      factor: 'Shallow breathing logged',
      category: 'breathing',
      present_in_flares: shallowBreathingCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(shallowBreathingCount / windows.length, baseline),
    })
  }

  const ateOutsideCount = windows.filter((w) => w.outsideMealCount > 0).length
  if (ateOutsideCount > 0) {
    const baseline = computeBaselineRate(allDates, (d) =>
      history.meals.some((m: any) => m.log_date === d && m.location === 'outside')
    )
    candidates.push({
      factor: 'Ate outside home',
      category: 'diet',
      present_in_flares: ateOutsideCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(ateOutsideCount / windows.length, baseline),
    })
  }

  const allAbnormalMarkers = Array.from(new Set(windows.flatMap((w) => w.abnormalMarkersAtTime)))
  for (const marker of allAbnormalMarkers) {
    const presentCount = windows.filter((w) => w.abnormalMarkersAtTime.includes(marker)).length
    const baseline = computeBaselineRate(allDates, (d) => abnormalMarkersOnDate(bloodReports, d).includes(marker))
    candidates.push({
      factor: `${marker} abnormal at time of flare`,
      category: 'blood_marker',
      present_in_flares: presentCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(presentCount / windows.length, baseline),
     })
  }

  // Per mental-state presence vs. baseline — same shape as supplements.
  // Surfaces things like "stressed" clustering around flares.
  const allMentalStates = Array.from(new Set(history.mentalStates.map((s: any) => s.state))) as string[]
  for (const state of allMentalStates) {
    const presentCount = windows.filter((w) => w.mentalStates.includes(state)).length
    if (presentCount === 0) continue
    const baseline = computeBaselineRate(allDates, (d) =>
      history.mentalStates.some((s: any) => s.log_date === d && s.state === state)
    )
    candidates.push({
      factor: `"${state}" logged`,
      category: 'mental_state',
      present_in_flares: presentCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(presentCount / windows.length, baseline),
    })
  }

  // Per exercise-type presence vs. baseline, plus a standalone "no exercise
  // logged" signal — exercise LOAD dropping off can matter as much as a
  // specific type showing up.
  const allExerciseTypes = Array.from(new Set(history.exercise.map((e: any) => e.exercise_type))) as string[]
  for (const type of allExerciseTypes) {
    const presentCount = windows.filter((w) => w.exerciseTypes.includes(type)).length
    if (presentCount === 0) continue
    const baseline = computeBaselineRate(allDates, (d) =>
      history.exercise.some((e: any) => e.log_date === d && e.exercise_type === type)
    )
    candidates.push({
      factor: `"${type}" logged`,
      category: 'exercise',
      present_in_flares: presentCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(presentCount / windows.length, baseline),
    })
  }

  const noExerciseCount = windows.filter((w) => w.exerciseTypes.length === 0).length
  if (noExerciseCount > 0) {
    const baseline = computeBaselineRate(allDates, (d) => !history.exercise.some((e: any) => e.log_date === d))
    candidates.push({
      factor: 'No exercise logged',
      category: 'exercise',
      present_in_flares: noExerciseCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(noExerciseCount / windows.length, baseline),
    })
  }

  // Day-of-week clustering — do flares disproportionately start on one
  // weekday versus the 1/7 baseline every day gets by chance? Needs at
  // least 2 flares sharing a weekday to call it a cluster at all.
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayOfWeek = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
  const flareDayCounts = new Map<number, number>()
  for (const w of windows) {
    const day = dayOfWeek(w.startDate)
    flareDayCounts.set(day, (flareDayCounts.get(day) ?? 0) + 1)
  }
  for (const [day, count] of flareDayCounts) {
    if (count < 2) continue
    const baseline = Math.round((1 / 7) * 100) / 100
    candidates.push({
      factor: `Flares cluster on ${DAY_NAMES[day]}s`,
      category: 'cycle',
      present_in_flares: count,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(count / windows.length, baseline),
    })
  }

  // Per outside-meal-reason presence vs. baseline — the emotion/circumstance
  // behind eating outside home ("stressed", "no time to cook", "social
  // outing"), not just the fact of it.
  const allOutsideReasons = Array.from(new Set(
    history.meals
      .filter((m: any) => m.location === 'outside' && m.outside_reason)
      .map((m: any) => m.outside_reason)
  )) as string[]
  for (const reason of allOutsideReasons) {
    const presentCount = windows.filter((w) => w.outsideMealReasons.includes(reason)).length
    if (presentCount === 0) continue
    const baseline = computeBaselineRate(allDates, (d) =>
      history.meals.some((m: any) => m.log_date === d && m.location === 'outside' && m.outside_reason === reason)
    )
    candidates.push({
      factor: `Ate outside — "${reason}"`,
      category: 'diet',
      present_in_flares: presentCount,
      of_flares: windows.length,
      baseline_rate: baseline,
      weight: computeWeight(presentCount / windows.length, baseline),
    })
  }

  return candidates
    .filter((c) => c.weight > MIN_WEIGHT_TO_SURFACE)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_CANDIDATES)
}
