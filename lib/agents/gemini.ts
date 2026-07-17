// lib/agents/gemini.ts
// FIXED: promptVersion is now optional in CallOptions. Your local version had
// it as required, which broke any caller (like the health-intelligence route)
// that didn't pass it. It's accepted for logging/traceability but not
// required, since it's not used in the actual Gemini request.
//
// FIXED (this pass): responses that hit MAX_TOKENS were silently attempted
// through JSON.parse and just failed with "Invalid JSON" — no repair, no
// signal about *why* it failed. Now we:
//   1. Detect finishReason === 'MAX_TOKENS' explicitly and log it distinctly
//      from a genuine malformed-JSON response.
//   2. Attempt a generic repair on truncated JSON by closing any open
//      strings/objects/arrays, so callers still get partial-but-valid data
//      instead of nothing.
//   3. Only throw if repair also fails.

import { jsonrepair } from 'jsonrepair'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logGeminiCall } from '../tokenLog'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'

// Rate limit: your prior quota was 5 RPM under gemini-2.5-flash's free
// tier. gemini-3.5-flash is a preview model with different (possibly
// billing-required) limits — check your actual quota in AI Studio after
// switching. Keeping this conservative default either way; lower it if
// you confirm a higher limit, raise it if you still see 429s.

// Free tier caps gemini-2.5-flash at 5 requests/min. 5/min = 1 every 12s
// exactly; 13.5s gives a safety margin for clock drift and other traffic
// on the same key. Every call passes through reserveSlot() below before
// hitting the network, regardless of how many callers fire "simultaneously"
// via Promise.all elsewhere (e.g. specialistBoard.ts) — this is the single
// choke point that serializes them.
const MIN_INTERVAL_MS = 13500
const MAX_RETRIES = 3

let reservationChain: Promise<void> = Promise.resolve()
let lastStart = 0

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function reserveSlot(): Promise<void> {
  const thisReservation = reservationChain.then(async () => {
    const now = Date.now()
    const wait = Math.max(0, lastStart + MIN_INTERVAL_MS - now)
    if (wait > 0) await sleep(wait)
    lastStart = Date.now()
  })
  // Keep the chain alive even if a reservation throws — one failure
  // shouldn't jam every call queued behind it.
  reservationChain = thisReservation.catch(() => {})
  return thisReservation
}

// Parses Gemini's own suggested wait time out of a 429 error message,
// e.g. "Please retry in 16.663156564s." Falls back to exponential backoff
// if the message doesn't include one.
function parseRetryDelayMs(errorText: string, attempt: number): number {
  const match = errorText.match(/retry in ([\d.]+)s/i)
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500 // small buffer
  return MIN_INTERVAL_MS * Math.pow(2, attempt) // 13.5s, 27s, 54s...
}

interface TextPart   { type: 'text';     text: string }
interface ImagePart  { type: 'image';    base64: string; mimeType: string }
interface DocPart    { type: 'document'; base64: string; mimeType: 'application/pdf' }
type GeminiPart = TextPart | ImagePart | DocPart

interface CallOptions {
  client: SupabaseClient   // request-scoped — needed to log token usage server-side
  agentId: string
  promptVersion?: string   // optional — kept for logging/traceability only
  systemPrompt: string
  userParts: GeminiPart[]
  temperature?: number     // no longer sent to Gemini 3.5 — kept for signature compatibility, ignored
  maxOutputTokens?: number
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' // default 'low'
}

function buildParts(parts: GeminiPart[]) {
  return parts.map((p) => {
    if (p.type === 'text') return { text: p.text }
    return { inline_data: { mime_type: p.mimeType, data: p.base64 } }
  })
}

// Repair for JSON truncated mid-stream (e.g. cut off right after a key's
// colon, with no value yet — `{"name":"Iron","value":` — which a naive
// bracket-closer will mishandle because the dangling key still needs a
// colon+value, not just closing braces). jsonrepair handles this class of
// truncation correctly, along with trailing commas, missing quotes, etc.
// This won't recover data that was never emitted, but it salvages
// everything that WAS emitted instead of discarding the whole response.
function repairTruncatedJSON(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    return jsonrepair(text)
  } catch {
    return null
  }
}

export async function callGeminiAgent<T>(opts: CallOptions): Promise<T> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const tag = `${opts.agentId}${opts.promptVersion ? ' ' + opts.promptVersion : ''}`
  const startTime = Date.now()

  let res: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await reserveSlot()

    try {
      res = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: opts.systemPrompt }] },
          contents: [{ role: 'user', parts: buildParts(opts.userParts) }],
          generationConfig: {
            // Gemini 3.5 Flash: temperature/top_p/top_k are no longer
            // recommended — the reasoning layer is calibrated around
            // defaults, per Google's migration guide. thinkingLevel replaces
            // thinkingBudget; without it the default ('medium') was eating
            // most of maxOutputTokens as invisible thinking tokens before
            // any visible output was written, causing MAX_TOKENS truncation
            // with almost nothing to show for it. 'low' leaves far more of
            // the budget for actual output on these structured-JSON tasks.
            maxOutputTokens: opts.maxOutputTokens ?? 2048,
            thinkingConfig: { thinkingLevel: opts.thinkingLevel ?? 'low' },
          },
        }),
      })
    } catch (networkErr) {
      // fetch() itself threw — a genuine network-level failure (DNS blip,
      // connection reset, "fetch failed"), not an HTTP error response.
      // Without this catch, this class of error skipped the retry loop
      // entirely and threw on the very first attempt.
      if (attempt === MAX_RETRIES) {
        console.error(`[${tag}] exhausted retries on network error:`, networkErr)
        throw new Error(`Gemini network error after ${MAX_RETRIES + 1} attempts: ${String(networkErr)}`)
      }
      const waitMs = MIN_INTERVAL_MS * Math.pow(2, attempt)
      console.warn(`[${tag}] network error, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`, networkErr)
      await sleep(waitMs)
      continue
    }

    if (res.status !== 429 && res.status !== 503) break

    const errorText = await res.text()
    if (attempt === MAX_RETRIES) {
      console.error(`[${tag}] exhausted retries on ${res.status}:`, errorText)
      throw new Error(`Gemini ${res.status}: ${errorText}`)
    }

    // 429 gives a suggested wait time; 503 (transient overload) doesn't,
    // so fall back to exponential backoff for it.
    const waitMs = res.status === 429
      ? parseRetryDelayMs(errorText, attempt)
      : MIN_INTERVAL_MS * Math.pow(2, attempt)
    console.warn(`[${tag}] ${res.status} — retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
    await sleep(waitMs)
  }

  if (!res) throw new Error(`Agent ${opts.agentId}: no response from Gemini`)

  if (!res.ok) {
   const errorText = await res.text();
   console.error("Gemini Error:", errorText);
   throw new Error(`Gemini ${res.status}: ${errorText}`);
}

  const data = await res.json()
  const latency = Date.now() - startTime
   const finishReason = data.candidates?.[0]?.finishReason

const usage = data.usageMetadata ?? {}

logGeminiCall(opts.client, opts.agentId, {
  input: usage.promptTokenCount ?? 0,
  output: usage.candidatesTokenCount ?? 0,
  total: usage.totalTokenCount ?? 0,
}, latency).catch(() => {})

console.log(`
====================================================
Agent           : ${opts.agentId}
Version         : ${opts.promptVersion ?? "unknown"}

Prompt Tokens   : ${usage.promptTokenCount ?? 0}
Output Tokens   : ${usage.candidatesTokenCount ?? 0}
Total Tokens    : ${usage.totalTokenCount ?? 0}

Latency         : ${latency} ms
Finish Reason   : ${finishReason}

====================================================
`)
 
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const clean = raw.replace(/```json\n?|```\n?/g, '').trim()

  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[${tag}] hit MAX_TOKENS — attempting repair`)
    const repaired = repairTruncatedJSON(clean)
    if (repaired) {
      try {
        return JSON.parse(repaired) as T
      } catch {
        console.error(`[${tag}] repair failed to produce valid JSON:`, repaired.slice(0, 600))
      }
    }
    throw new Error(`Agent ${opts.agentId} response truncated at ${opts.maxOutputTokens ?? 2048} tokens — try raising maxOutputTokens`)
  }

  try {
    return JSON.parse(clean) as T
  } catch {
    // Not flagged as MAX_TOKENS but still malformed — try the same repair
    // before giving up, in case Gemini stopped for another reason mid-JSON.
    const repaired = repairTruncatedJSON(clean)
    if (repaired) {
      try {
        return JSON.parse(repaired) as T
      } catch {
        // fall through to original error below
      }
    }
    console.error(`[${tag}] Invalid JSON:`, clean.slice(0, 600))
    throw new Error(`Agent ${opts.agentId} returned invalid JSON`)
  }
}