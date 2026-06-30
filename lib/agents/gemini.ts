// lib/agents/gemini.ts
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

interface TextPart   { type: 'text';     text: string }
interface ImagePart  { type: 'image';    base64: string; mimeType: string }
interface DocPart    { type: 'document'; base64: string; mimeType: 'application/pdf' }
type GeminiPart = TextPart | ImagePart | DocPart

interface CallOptions {
  agentId: string
  promptVersion: string
  systemPrompt: string
  userParts: GeminiPart[]
  temperature?: number
  maxOutputTokens?: number
}

function buildParts(parts: GeminiPart[]) {
  return parts.map((p) => {
    if (p.type === 'text') return { text: p.text }
    return { inline_data: { mime_type: p.mimeType, data: p.base64 } }
  })
}

export async function callGeminiAgent<T>(opts: CallOptions): Promise<T> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: opts.systemPrompt }] },
      contents: [{ role: 'user', parts: buildParts(opts.userParts) }],
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
      },
    }),
  })

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const clean = raw.replace(/```json\n?|```\n?/g, '').trim()

  try {
    return JSON.parse(clean) as T
  } catch {
    console.error(`[${opts.agentId}] Invalid JSON:`, clean)
    throw new Error(`Agent ${opts.agentId} returned invalid JSON`)
  }
}