// lib/extractPrescription.ts
// Pure extraction — prescription photo/PDF to structured medication list.
// No interpretation, no dosing advice, no dates. Mirrors lib/extractMarkers.ts
// (standalone, not routed through lib/agents/gemini.ts's rate-limited queue —
// this is one-off parsing, not part of the agent pipeline).

import type { SupabaseClient } from '@supabase/supabase-js'
import { logGeminiCall } from './tokenLog'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

export interface ExtractedMedication {
  name: string
  dosage: string | null
  frequency: string | null
}

export async function extractPrescription(base64: string, mimeType: string, client: SupabaseClient): Promise<{
  medications: ExtractedMedication[]
  extractionError?: string
}> {
  if (!GEMINI_API_KEY) {
    return { medications: [], extractionError: 'GEMINI_API_KEY not set' }
  }

  const prompt = `You are a prescription parser. Your ONLY job is to extract every medication listed on this prescription as structured JSON.

RULES:
- Extract EVERY medication — do not stop early, do not summarise.
- For each: name (as written, normalised to standard spelling if clearly misspelled), dosage (e.g. "500mg", null if not stated), frequency (e.g. "twice daily", "as needed", null if not stated).
- Do NOT extract or infer start/end dates or treatment duration — that is handled separately.
- Do NOT add dosing advice, warnings, or any interpretation — extraction only.
- Return ONLY a raw JSON array. No markdown. No fences. No explanation.

FORMAT:
[{"name":"Amoxicillin","dosage":"500mg","frequency":"twice daily"},{"name":"Paracetamol","dosage":"650mg","frequency":"as needed"}]`

  const startTime = Date.now()
  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[gemini prescription] HTTP error:', response.status, errText.slice(0, 300))
      return { medications: [], extractionError: `Gemini API ${response.status}` }
    }

    const geminiData = await response.json()
    const usage = geminiData.usageMetadata ?? {}
    logGeminiCall(client, 'EXTRACT_PRESCRIPTION', {
      input: usage.promptTokenCount ?? 0,
      output: usage.candidatesTokenCount ?? 0,
      total: usage.totalTokenCount ?? 0,
    }, Date.now() - startTime).catch(() => {})

    if (!geminiData.candidates?.length) {
      const reason = geminiData.promptFeedback?.blockReason ?? 'unknown'
      console.error('[gemini prescription] no candidates, reason:', reason)
      return {
        medications: [],
        extractionError: `Gemini returned no output (${reason}). Image may be unclear, password-protected, or empty.`,
      }
    }

    const finishReason = geminiData.candidates[0]?.finishReason
    const rawText: string = geminiData.candidates[0]?.content?.parts?.[0]?.text ?? ''

    if (finishReason === 'MAX_TOKENS') {
      console.warn('[gemini prescription] hit MAX_TOKENS')
      return { medications: [], extractionError: 'Response truncated — try retrying' }
    }

    const clean = rawText.replace(/```json\n?|```\n?/g, '').trim()

    try {
      const medications = JSON.parse(clean)
      if (!Array.isArray(medications)) {
        return { medications: [], extractionError: 'Unexpected JSON shape from Gemini' }
      }
      const normalized: ExtractedMedication[] = medications
        .filter((m) => m && typeof m.name === 'string' && m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          dosage: typeof m.dosage === 'string' && m.dosage.trim() ? m.dosage.trim() : null,
          frequency: typeof m.frequency === 'string' && m.frequency.trim() ? m.frequency.trim() : null,
        }))
      if (normalized.length === 0) {
        return { medications: [], extractionError: 'No medications found in the image' }
      }
      console.log(`[gemini prescription] success: ${normalized.length} medication(s)`)
      return { medications: normalized }
    } catch {
      console.error('[gemini prescription] JSON parse failed. Raw:', clean.slice(0, 600))
      return { medications: [], extractionError: 'Could not parse Gemini response — try retrying' }
    }
  } catch (err) {
    console.error('[gemini prescription] fetch error:', err)
    return { medications: [], extractionError: `Network error: ${String(err)}` }
  }
}
