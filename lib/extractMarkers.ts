// lib/extractMarkers.ts
// Pure extraction — PDF to structured JSON markers.
// No interpretation, no analysis. Moved out of route.ts because Next.js
// App Router route files may only export HTTP method handlers (GET, POST,
// etc.) and a small set of config options — any other named export fails
// the build-time route type check.

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

export async function extractMarkersFromPDF(base64PDF: string): Promise<{
  markers: Record<string, { value: number; unit: string; reference?: string }>
  extractionError?: string
}> {
  if (!GEMINI_API_KEY) {
    return { markers: {}, extractionError: 'GEMINI_API_KEY not set' }
  }

  const prompt = `You are a medical lab report parser. Your ONLY job is to extract every numeric test result from this PDF as structured JSON.

RULES:
- Extract EVERY marker — do not stop early, do not summarise.
- Return the complete JSON object without truncation.
- Each marker: numeric value (number type), unit string, reference range string if present.
- Normalise names to standard English: "Haemoglobin"→"Hemoglobin", "S.Ferritin"→"Ferritin", "T3 Total"→"T3", etc.
- For "<0.01" or ">100" values, use the numeric boundary.
- Skip non-numeric results unless they have a numeric equivalent.
- Return ONLY the raw JSON object. No markdown. No fences. No explanation.

FORMAT:
{"MarkerName":{"value":13.2,"unit":"g/dL","reference":"12.0 - 17.0"},"Next":{"value":95,"unit":"fL"}}`

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64PDF } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[gemini extract] HTTP error:', response.status, errText.slice(0, 300))
      return { markers: {}, extractionError: `Gemini API ${response.status}` }
    }

    const geminiData = await response.json()

    if (!geminiData.candidates?.length) {
      const reason = geminiData.promptFeedback?.blockReason ?? 'unknown'
      console.error('[gemini extract] no candidates, reason:', reason)
      return {
        markers: {},
        extractionError: `Gemini returned no output (${reason}). PDF may be scanned/image-only, password-protected, or empty.`,
      }
    }

    const finishReason = geminiData.candidates[0]?.finishReason
    const rawText: string = geminiData.candidates[0]?.content?.parts?.[0]?.text ?? ''

    if (finishReason === 'MAX_TOKENS') {
      console.warn('[gemini extract] hit MAX_TOKENS — attempting JSON repair')
      const repaired = repairTruncatedJSON(rawText)
      if (repaired && Object.keys(repaired).length > 0) {
        console.log(`[gemini extract] repaired ${Object.keys(repaired).length} markers`)
        return { markers: repaired }
      }
      return { markers: {}, extractionError: 'Response truncated even at 8192 tokens — try retrying' }
    }

    const clean = rawText.replace(/```json\n?|```\n?/g, '').trim()

    try {
      const markers = JSON.parse(clean)
      if (typeof markers !== 'object' || Array.isArray(markers)) {
        return { markers: {}, extractionError: 'Unexpected JSON shape from Gemini' }
      }
      if (Object.keys(markers).length === 0) {
        return { markers: {}, extractionError: 'No lab values found in PDF' }
      }
      console.log(`[gemini extract] success: ${Object.keys(markers).length} markers`)
      return { markers }
    } catch {
      console.error('[gemini extract] JSON parse failed. Raw:', clean.slice(0, 600))
      const repaired = repairTruncatedJSON(clean)
      if (repaired && Object.keys(repaired).length > 0) {
        console.log(`[gemini extract] repaired ${Object.keys(repaired).length} markers after parse failure`)
        return { markers: repaired }
      }
      return { markers: {}, extractionError: 'Could not parse Gemini response — try retrying' }
    }
  } catch (err) {
    console.error('[gemini extract] fetch error:', err)
    return { markers: {}, extractionError: `Network error: ${String(err)}` }
  }
}

// Salvages complete marker entries from a truncated or malformed JSON string.
export function repairTruncatedJSON(
  raw: string
): Record<string, { value: number; unit: string; reference?: string }> | null {
  try { return JSON.parse(raw) } catch { /* fall through to regex repair */ }

  const result: Record<string, { value: number; unit: string; reference?: string }> = {}
  const pattern = /"([^"]+)":\s*\{\s*"value":\s*([\d.]+),\s*"unit":\s*"([^"]*)"(?:,\s*"reference":\s*"([^"]*)")?\s*\}/g
  let match
  while ((match = pattern.exec(raw)) !== null) {
    const [, name, value, unit, reference] = match
    result[name] = { value: parseFloat(value), unit, ...(reference ? { reference } : {}) }
  }
  return Object.keys(result).length > 0 ? result : null
}