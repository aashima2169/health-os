// lib/agents/specialistBoard.ts
// A3: Multi-specialist board. Each specialist reasons independently over
// the data through their own lens — they do not see each other's output.
// The consolidator (in healthIntelligence.ts) combines their findings
// afterward. Acupuncturist intentionally omitted (see prompts.ts).
//
// PERSISTENCE: each specialist's result is saved to the DB the moment it
// completes (success or error) — not batched with the others. Before
// calling Gemini, each specialist checks the store first: if a successful
// result already exists for this (specialist, period), it's reused and no
// Gemini call is made. The cache is invalidated externally (see
// bloodIntelligence.ts / lifestyleIntelligence.ts) whenever underlying
// data actually changes.
import { getFullHistory, getLatestWeeklyPhotoByType } from '../db'
import { callGeminiAgent } from './gemini'
import {
  PHYSICIAN_PROMPT, PHYSICIAN_VERSION,
  DERMATOLOGIST_PROMPT, DERMATOLOGIST_VERSION,
  PSYCHOLOGIST_PROMPT, PSYCHOLOGIST_VERSION,
  GUT_MICROBIOME_PROMPT, GUT_MICROBIOME_VERSION,
  NUTRITIONIST_PROMPT, NUTRITIONIST_VERSION,
  TCM_PRACTITIONER_PROMPT, TCM_PRACTITIONER_VERSION,
} from './prompts'
import { AgentId, getAgentResult, saveAgentResult, markGenerating } from './store'
import { Period, daysForPeriod, mondayOfWeek } from '../date'
import { getQuestionsForAgent, upsertQuestions } from './qa'

export const SPECIALIST_AGENT_IDS: AgentId[] = ['A3a', 'A3b', 'A3c', 'A3d', 'A3e', 'A3f']

type History = Awaited<ReturnType<typeof getFullHistory>>
type GeminiPart =
  | { type: 'text'; text: string }
  | { type: 'image'; base64: string; mimeType: string }

async function runSpecialist(
  agentId: AgentId,
  period: Period,
  promptVersion: string,
  systemPrompt: string,
  dataLabel: string,
  data: unknown,
  extraParts: GeminiPart[] = [],
): Promise<Record<string, any>> {
  const cached = await getAgentResult(agentId, period)
  if (cached && cached.status === 'success') {
    return { ...cached.result, has_data: true, cached: true }
  }

  await markGenerating(agentId, period)
  try {
    // Pull in any questions this specialist has previously asked that the
    // person has since answered themselves — self-reported context that
    // wasn't available from logged data alone. This is what makes an
    // answer "feed back into future analysis" rather than just being saved.
    const priorQA = await getQuestionsForAgent(agentId)
    const answered = priorQA.filter((q) => q.answer)
    const dataWithAnswers = answered.length > 0
      ? { ...(data as object), previously_answered_questions: answered.map((q) => ({ question: q.question, answer: q.answer })) }
      : data

    const result = await callGeminiAgent<Record<string, any>>({
      agentId,
      promptVersion,
      systemPrompt,
      userParts: [
        { type: 'text', text: `${dataLabel}:\n${JSON.stringify(dataWithAnswers, null, 2)}` },
        ...extraParts,
      ],
      temperature: 0.3,
      maxOutputTokens: 4096,
    })
    const finalResult = { ...result, has_data: true }
    await saveAgentResult(agentId, finalResult, { period, version: promptVersion })

    // Save any new questions this run asked, so they show up on the
    // Insights page for the person to answer.
    if (Array.isArray(result.questions_for_this_specialty)) {
      upsertQuestions(agentId, result.questions_for_this_specialty).catch((err) =>
        console.error(`[${agentId}] failed to save questions:`, err),
      )
    }

    return finalResult
  } catch (err) {
    console.error(`[${agentId}] specialist failed:`, err)
    const errorResult = { has_data: false, error: String(err) }
    await saveAgentResult(agentId, errorResult, { period, version: promptVersion, status: 'error', error: String(err) })
    return errorResult
  }
}

export async function runPhysician(bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist('A3a', period, PHYSICIAN_VERSION, PHYSICIAN_PROMPT, 'Blood Intelligence output, general daily logs, and exercise/recovery logs', {
    blood_intelligence: bloodResult,
    daily_logs: history.logs,
    exercise: history.exercise,
    recovery: history.recovery,
  })
}

export async function runDermatologist(bloodResult: Record<string, any>, history: History, period: Period) {
  const skinPhotoParts = await fetchWeeklyPhotoParts(['acne', 'flare'])
  const photoNote = skinPhotoParts.length > 0
    ? `, and ${skinPhotoParts.length} skin photo(s) attached as images`
    : ' — no skin photos are available for this pass'
  return runSpecialist(
    'A3b', period, DERMATOLOGIST_VERSION, DERMATOLOGIST_PROMPT,
    `Logged health events (flares, etc.), and Blood Intelligence output for context${photoNote}`,
    {
      blood_intelligence: bloodResult,
      health_events: history.healthEvents,
    },
    skinPhotoParts,
  )
}

export async function runPsychologist(bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist('A3c', period, PSYCHOLOGIST_VERSION, PSYCHOLOGIST_PROMPT, 'Mental states, daily logs (including written reflections), and Blood Intelligence output for context', {
    blood_intelligence: bloodResult,
    mental_states: history.mentalStates,
    daily_logs: history.logs,
    recovery: history.recovery,
  })
}

// Restricted by design — diet + supplements are the PRIMARY data.
export async function runGutMicrobiomeDoctor(bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist('A3d', period, GUT_MICROBIOME_VERSION, GUT_MICROBIOME_PROMPT, 'Meals, supplements, and Blood Intelligence output for context', {
    blood_intelligence: bloodResult,
    meals: history.meals,
    supplements: history.supplements,
  })
}

export async function runNutritionist(bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist('A3f', period, NUTRITIONIST_VERSION, NUTRITIONIST_PROMPT, 'Meals, supplements, daily logs (including weight), and Blood Intelligence output for context', {
    blood_intelligence: bloodResult,
    meals: history.meals,
    supplements: history.supplements,
    daily_logs: history.logs,
  })
}

// Fetches the most recent photo(s) of the given type(s) and downloads them
// as base64 so a specialist can examine them directly as images, not just
// reason about them secondhand. Generic version of what TCM already used
// for tongue photos — now also used by Dermatologist for acne/flare.
async function fetchWeeklyPhotoParts(photoTypes: string[]): Promise<GeminiPart[]> {
  const currentWeek = mondayOfWeek()
  const parts: GeminiPart[] = []

  for (const photoType of photoTypes) {
    try {
      const photo = await getLatestWeeklyPhotoByType(photoType, currentWeek)
      if (!photo?.photo_url) continue

      const res = await fetch(photo.photo_url)
      if (!res.ok) continue
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = res.headers.get('content-type') || 'image/jpeg'

      parts.push({ type: 'image', base64, mimeType })
    } catch (err) {
      console.error(`[photo fetch] failed to fetch ${photoType} photo, proceeding without it:`, err)
    }
  }

  return parts
}

export async function runTcmPractitioner(bloodResult: Record<string, any>, history: History, period: Period) {
  const tonguePart = await fetchWeeklyPhotoParts(['tongue'])
  return runSpecialist(
    'A3e', period, TCM_PRACTITIONER_VERSION, TCM_PRACTITIONER_PROMPT,
    `Daily logs, mental states, periods, exercise logs, Blood Intelligence output for context${tonguePart.length ? ', and a tongue photo (attached as an image)' : ' — no tongue photo is available for this pass'}`,
    {
      blood_intelligence: bloodResult,
      daily_logs: history.logs,
      mental_states: history.mentalStates,
      periods: history.periods,
      exercise: history.exercise,
    },
    tonguePart,
  )
}

// Runs all six specialists in parallel for the given period.
export async function runSpecialistBoard(bloodResult: Record<string, any>, period: Period) {
  const days = daysForPeriod(period)
  const history = await getFullHistory(days)

  const [physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner] =
    await Promise.all([
      runPhysician(bloodResult, history, period),
      runDermatologist(bloodResult, history, period),
      runPsychologist(bloodResult, history, period),
      runGutMicrobiomeDoctor(bloodResult, history, period),
      runNutritionist(bloodResult, history, period),
      runTcmPractitioner(bloodResult, history, period),
    ])

  return { physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner }
}

// Reads the CURRENT stored state of all six specialists for a period,
// without triggering any Gemini calls — used for progressive UI rendering.
export async function getSpecialistBoardSnapshot(period: Period) {
  const [physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner] =
    await Promise.all([
      getAgentResult('A3a', period),
      getAgentResult('A3b', period),
      getAgentResult('A3c', period),
      getAgentResult('A3d', period),
      getAgentResult('A3f', period),
      getAgentResult('A3e', period),
    ])

  return { physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner }
}