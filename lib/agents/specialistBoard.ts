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
//
// Server-only — `client` is required (request-scoped, from
// lib/supabaseServer.ts), threaded through to every store/gemini call.
import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getFullHistory, getMostRecentWeeklyPhotoByType } from '../db'
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
import { Period, daysForPeriod } from '../date'
import { getQuestionsForAgent, upsertQuestions } from './qa'

export const SPECIALIST_AGENT_IDS: AgentId[] = ['A3a', 'A3b', 'A3c', 'A3d', 'A3e', 'A3f']

type History = Awaited<ReturnType<typeof getFullHistory>>
type GeminiPart =
  | { type: 'text'; text: string }
  | { type: 'image'; base64: string; mimeType: string }

async function runSpecialist(
  client: SupabaseClient,
  agentId: AgentId,
  period: Period,
  promptVersion: string,
  systemPrompt: string,
  dataLabel: string,
  data: unknown,
  extraParts: GeminiPart[] = [],
): Promise<Record<string, any>> {
  const cached = await getAgentResult(client, agentId, period)
  if (cached && cached.status === 'success') {
    return { ...cached.result, has_data: true, cached: true }
  }

  await markGenerating(client, agentId, period)
  try {
    // Pull in any questions this specialist has previously asked that the
    // person has since answered themselves — self-reported context that
    // wasn't available from logged data alone. This is what makes an
    // answer "feed back into future analysis" rather than just being saved.
    const priorQA = await getQuestionsForAgent(client, agentId)
    const answered = priorQA.filter((q) => q.answer)
    const dataWithAnswers = answered.length > 0
      ? { ...(data as object), previously_answered_questions: answered.map((q) => ({ question: q.question, answer: q.answer })) }
      : data

    const result = await callGeminiAgent<Record<string, any>>({
      client,
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
    await saveAgentResult(client, agentId, finalResult, { period, version: promptVersion })

    // Save any new questions this run asked, so they show up on the
    // Insights page for the person to answer.
    if (Array.isArray(result.questions_for_this_specialty)) {
      upsertQuestions(client, agentId, result.questions_for_this_specialty).catch((err) =>
        console.error(`[${agentId}] failed to save questions:`, err),
      )
    }

    return finalResult
  } catch (err) {
    console.error(`[${agentId}] specialist failed:`, err)
    const errorResult = { has_data: false, error: String(err) }
    await saveAgentResult(client, agentId, errorResult, { period, version: promptVersion, status: 'error', error: String(err) })
    return errorResult
  }
}

export async function runPhysician(client: SupabaseClient, bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist(client, 'A3a', period, PHYSICIAN_VERSION, PHYSICIAN_PROMPT, 'Blood Intelligence output, general daily logs, and exercise/recovery logs', {
    blood_intelligence: bloodResult,
    daily_logs: history.logs,
    exercise: history.exercise,
    recovery: history.recovery,
  })
}

export async function runDermatologist(client: SupabaseClient, bloodResult: Record<string, any>, history: History, period: Period) {
  const skinPhotoParts = await fetchWeeklyPhotoParts(client, ['acne', 'flare'])
  const photoNote = skinPhotoParts.length > 0
    ? `, and ${skinPhotoParts.length} skin photo(s) attached as images`
    : ' — no skin photos are available for this pass'
  return runSpecialist(
    client, 'A3b', period, DERMATOLOGIST_VERSION, DERMATOLOGIST_PROMPT,
    `Logged health events (flares, etc.), and Blood Intelligence output for context${photoNote}`,
    {
      blood_intelligence: bloodResult,
      health_events: history.healthEvents,
    },
    skinPhotoParts,
  )
}

export async function runPsychologist(client: SupabaseClient, bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist(client, 'A3c', period, PSYCHOLOGIST_VERSION, PSYCHOLOGIST_PROMPT, 'Mental states, daily logs (including written reflections), menstrual cycle data, and Blood Intelligence output for context', {
    blood_intelligence: bloodResult,
    mental_states: history.mentalStates,
    daily_logs: history.logs,
    recovery: history.recovery,
    periods: history.periods,
  })
}

// Restricted by design — diet + supplements are the PRIMARY data.
export async function runGutMicrobiomeDoctor(client: SupabaseClient, bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist(client, 'A3d', period, GUT_MICROBIOME_VERSION, GUT_MICROBIOME_PROMPT, 'Meals, supplements, and Blood Intelligence output for context', {
    blood_intelligence: bloodResult,
    meals: history.meals,
    supplements: history.supplements,
  })
}

// Hardcoded until a proper user-profile/settings table exists — this is a
// single-user app currently, so a fixed constant is pragmatic for now, but
// this should move to a real settings field if the app ever supports more
// than one person.
const USER_HEIGHT_CM = 163 // 5'4"

export async function runNutritionist(client: SupabaseClient, bloodResult: Record<string, any>, history: History, period: Period) {
  return runSpecialist(client, 'A3f', period, NUTRITIONIST_VERSION, NUTRITIONIST_PROMPT, 'Meals, supplements, daily logs (including weight), height, and Blood Intelligence output for context', {
    blood_intelligence: bloodResult,
    meals: history.meals,
    supplements: history.supplements,
    daily_logs: history.logs,
    height_cm: USER_HEIGHT_CM,
  })
}

// Original phone-camera photos run 8-10MB+ uncompressed — Gemini charges
// per image tile, so an unresized upload can cost thousands of tokens more
// than a resized one for identical visual information (nothing about a
// skin patch or tongue color needs full sensor resolution). Downscaled to
// this max dimension and re-encoded as JPEG before ever reaching Gemini.
const PHOTO_MAX_DIMENSION = 768
const PHOTO_JPEG_QUALITY = 80

// Fetches the most recent photo(s) of the given type(s), downloads and
// compresses them, and returns them as base64 so a specialist can examine
// them directly as images, not just reason about them secondhand. Generic
// version of what TCM already used for tongue photos — now also used by
// Dermatologist for acne/flare, and by Signals. Logs each step clearly so
// a failure is diagnosable from Vercel logs instead of silently just not
// attaching a photo with no trace of why.
export async function fetchWeeklyPhotoParts(client: SupabaseClient, photoTypes: string[]): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = []

  for (const photoType of photoTypes) {
    try {
      const photo = await getMostRecentWeeklyPhotoByType(photoType, client)
      if (!photo?.photo_url) {
        console.warn(`[photo fetch] no '${photoType}' photo row found in weekly_photos at all`)
        continue
      }
      console.log(`[photo fetch] found '${photoType}' photo: week_of=${photo.week_of}, url=${photo.photo_url}`)

      const res = await fetch(photo.photo_url)
      if (!res.ok) {
        console.warn(`[photo fetch] '${photoType}' photo row exists but download failed: HTTP ${res.status} for ${photo.photo_url}`)
        continue
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const originalMimeType = res.headers.get('content-type') || 'image/jpeg'

      let base64 = buffer.toString('base64')
      let mimeType = originalMimeType
      try {
        const resized = await sharp(buffer)
          .resize(PHOTO_MAX_DIMENSION, PHOTO_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: PHOTO_JPEG_QUALITY })
          .toBuffer()
        base64 = resized.toString('base64')
        mimeType = 'image/jpeg'
        console.log(`[photo fetch] '${photoType}' compressed: ${buffer.byteLength} -> ${resized.byteLength} bytes`)
      } catch (resizeErr) {
        console.warn(`[photo fetch] '${photoType}' resize failed, using original:`, resizeErr)
      }

      console.log(`[photo fetch] '${photoType}' photo ready: ${Math.round((base64.length * 3) / 4)} bytes, ${mimeType}`)
      parts.push({ type: 'image', base64, mimeType })
    } catch (err) {
      console.error(`[photo fetch] exception fetching '${photoType}' photo, proceeding without it:`, err)
    }
  }

  return parts
}

export async function runTcmPractitioner(client: SupabaseClient, bloodResult: Record<string, any>, history: History, period: Period) {
  const tonguePart = await fetchWeeklyPhotoParts(client, ['tongue'])
  return runSpecialist(
    client, 'A3e', period, TCM_PRACTITIONER_VERSION, TCM_PRACTITIONER_PROMPT,
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
export async function runSpecialistBoard(client: SupabaseClient, bloodResult: Record<string, any>, period: Period) {
  const days = daysForPeriod(period)
  const history = await getFullHistory(days, client)

  const [physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner] =
    await Promise.all([
      runPhysician(client, bloodResult, history, period),
      runDermatologist(client, bloodResult, history, period),
      runPsychologist(client, bloodResult, history, period),
      runGutMicrobiomeDoctor(client, bloodResult, history, period),
      runNutritionist(client, bloodResult, history, period),
      runTcmPractitioner(client, bloodResult, history, period),
    ])

  return { physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner }
}

// Reads the CURRENT stored state of all six specialists for a period,
// without triggering any Gemini calls — used for progressive UI rendering.
export async function getSpecialistBoardSnapshot(client: SupabaseClient, period: Period) {
  const [physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner] =
    await Promise.all([
      getAgentResult(client, 'A3a', period),
      getAgentResult(client, 'A3b', period),
      getAgentResult(client, 'A3c', period),
      getAgentResult(client, 'A3d', period),
      getAgentResult(client, 'A3f', period),
      getAgentResult(client, 'A3e', period),
    ])

  return { physician, dermatologist, psychologist, gutMicrobiomeDoctor, nutritionist, tcmPractitioner }
}
