// app/api/blood-reports/compare/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

export async function GET() {
  try {
    // Fetch all reports ordered by date
    const { data: reports, error } = await supabase
      .from('blood_reports')
      .select('id, report_date, markers, notes')
      .order('report_date', { ascending: true })

    if (error) throw error
    if (!reports || reports.length === 0) {
      return NextResponse.json({ summary: null, changes: [], message: 'No reports yet.' })
    }
    if (reports.length === 1) {
      return NextResponse.json({
        summary: null,
        changes: [],
        message: 'Upload a second report to see what has changed.',
        baseline: reports[0],
      })
    }

    const latest = reports[reports.length - 1]
    const previous = reports[reports.length - 2]

    const prompt = `
You are a health data analyst helping someone understand their blood test results.
Compare the two blood reports below and explain what has improved, what has worsened,
and what is unchanged. 

Rules:
- Never make medical diagnoses.
- Be specific: name each marker, its old value, new value, and direction.
- Use plain English. Avoid jargon where possible.
- Flag any marker that has moved outside the reference range (if provided).
- Tone: calm, informative, like a knowledgeable friend, not a doctor.
- Return ONLY valid JSON, no markdown, no preamble.

Previous report (${previous.report_date}):
${JSON.stringify(previous.markers, null, 2)}

Latest report (${latest.report_date}):
${JSON.stringify(latest.markers, null, 2)}

JSON shape:
{
  "summary": "2-3 sentence overall summary of change between the two reports.",
  "improved": [
    { "marker": "Vitamin D", "from": 18.5, "to": 34.2, "unit": "ng/mL", "note": "Now within normal range." }
  ],
  "worsened": [
    { "marker": "TSH", "from": 2.4, "to": 5.8, "unit": "mIU/L", "note": "Now above normal range (0.4–4.0)." }
  ],
  "unchanged": [
    { "marker": "Hemoglobin", "value": 13.2, "unit": "g/dL", "note": "Stable and within range." }
  ],
  "watch": ["List any markers that need attention, as plain strings."]
}
`.trim()

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    })

    if (!response.ok) {
      console.error('[compare] Gemini error:', await response.text())
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
    }

    const geminiData = await response.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({
      ...parsed,
      previousDate: previous.report_date,
      latestDate: latest.report_date,
    })
  } catch (err) {
    console.error('[compare] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}