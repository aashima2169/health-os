// app/api/blood-reports/route.ts
// Upload PDF → extract markers via Gemini → save to blood_reports table
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const reportDate = formData.get('report_date') as string | null
    const notes = (formData.get('notes') as string | null) ?? ''

    if (!file || !reportDate) {
      return NextResponse.json({ error: 'file and report_date are required' }, { status: 400 })
    }

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const fileBuffer = await file.arrayBuffer()

    const { data: storageData, error: storageError } = await supabase.storage
      .from('blood-reports')
      .upload(fileName, fileBuffer, { contentType: 'application/pdf' })

    if (storageError) {
      console.error('[blood-reports] storage error:', storageError)
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('blood-reports').getPublicUrl(storageData.path)
    const fileUrl = urlData.publicUrl

    const base64PDF = Buffer.from(fileBuffer).toString('base64')
    const markers = await extractMarkersWithGemini(base64PDF)

    const { data: report, error: dbError } = await supabase
      .from('blood_reports')
      .insert({ report_date: reportDate, file_url: fileUrl, markers, notes })
      .select()
      .single()

    if (dbError) {
      console.error('[blood-reports] db error:', dbError)
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
    }

    return NextResponse.json({ report })
  } catch (err) {
    console.error('[blood-reports POST] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('blood_reports').select('*').order('report_date', { ascending: false })
    if (error) throw error
    return NextResponse.json({ reports: data ?? [] })
  } catch (err) {
    console.error('[blood-reports GET] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, file_url } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (file_url) {
      const path = file_url.split('/blood-reports/')[1]
      if (path) await supabase.storage.from('blood-reports').remove([path])
    }

    await supabase.from('blood_reports').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[blood-reports DELETE] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function extractMarkersWithGemini(
  base64PDF: string
): Promise<Record<string, { value: number; unit: string; reference?: string }>> {
  const prompt = `
You are a medical report parser. Extract all lab test markers from this blood report PDF.

Rules:
- Extract every marker/test result you can find.
- For each marker return: the numeric value, the unit, and the reference range if shown.
- Normalise marker names to standard English (e.g. "Haemoglobin" → "Hemoglobin").
- If a value is marked as "<0.01" or ">100", use the numeric boundary.
- Ignore non-numeric results unless they have a numeric equivalent.
- Return ONLY valid JSON, no markdown, no preamble.

JSON shape:
{
  "Hemoglobin": { "value": 13.2, "unit": "g/dL", "reference": "12.0 - 17.0" },
  "TSH": { "value": 2.4, "unit": "mIU/L", "reference": "0.4 - 4.0" }
}
`.trim()

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
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })

  if (!response.ok) {
    console.error('[gemini extract] failed:', await response.text())
    return {}
  }

  const geminiData = await response.json()
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    console.error('[gemini extract] JSON parse failed:', clean)
    return {}
  }
}