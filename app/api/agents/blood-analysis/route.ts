// app/api/agents/blood-analysis/route.ts
// A4b: Blood Analysis Agent
// Separate from A4a (extraction in /api/blood-reports/route.ts).
// Reads already-extracted markers from DB, interprets them, and
// compares across reports to surface trends and changes.
// Called from the Insights page blood section.
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { callGeminiAgent } from '../../../../lib/agents/gemini'
import { BLOOD_REPORT_VERSION } from '../../../../lib/agents/prompts'

const BLOOD_ANALYSIS_PROMPT = `
You are the Blood Analysis Agent for Health OS, version BLOOD-v1.1.

You have two responsibilities:
1. Interpret the most recent blood report — explain each marker in plain language.
2. Compare across all reports provided — identify what has improved, worsened, or stayed stable.

INTERPRETATION RULES
- Group markers by body system: Iron & Ferritin, Thyroid, Vitamins & Minerals, Blood Sugar & Insulin, Hormones, CBC, Inflammation, Liver, Kidney, Lipids, Other.
- For each marker: one sentence explaining what it measures and why it matters for overall health.
- Status: "normal" | "borderline_low" | "low" | "borderline_high" | "high". Borderline = within 10% of the boundary.
- Use the lab's own reference range, not population averages.
- Flag anything outside range in plain language.

COMPARISON RULES (when 2+ reports provided)
- Compare each marker that appears in both reports.
- Direction: "improved" | "worsened" | "stable" | "new" (first time appearing).
- Be specific: name old value, new value, unit, and what the change might mean in plain terms.
- Flag any marker that has crossed into or out of the normal range between reports.

WHAT YOU MUST NOT DO
- Never diagnose. Never say "you have X condition."
- Never recommend supplement doses.
- Never use words like "dangerous" or "critical" — instead flag for professional review.
- Never make claims beyond what the data shows.

TONE: informative, calm, empowering. Like a knowledgeable friend helping you understand your own results.

Return ONLY valid JSON. No markdown. No preamble.
`.trim()

export async function GET() {
  try {
    const { data: reports, error } = await supabase
      .from('blood_reports')
      .select('id, report_date, markers, notes, extraction_status')
      .eq('extraction_status', 'success')
      .order('report_date', { ascending: true })

    if (error) throw error

    if (!reports || reports.length === 0) {
      return NextResponse.json({
        agent_id: 'A4b',
        message: 'No successfully extracted blood reports found. Upload a report first.',
        has_data: false,
      })
    }

    const latest = reports[reports.length - 1]
    const previous = reports.length >= 2 ? reports[reports.length - 2] : null

    const result = await callGeminiAgent<Record<string, any>>({
      agentId: 'A4b',
      promptVersion: BLOOD_REPORT_VERSION,
      systemPrompt: BLOOD_ANALYSIS_PROMPT,
      userParts: [
        {
          type: 'text',
          text: `Analyse these blood reports.

Latest report (${latest.report_date}):
${JSON.stringify(latest.markers, null, 2)}

${previous
  ? `Previous report (${previous.report_date}):\n${JSON.stringify(previous.markers, null, 2)}`
  : 'No previous report available for comparison.'
}

${reports.length > 2
  ? `All report dates for trend context: ${reports.map((r) => r.report_date).join(', ')}`
  : ''
}

Return JSON in this shape:
{
  "latest_date": "YYYY-MM-DD",
  "previous_date": "YYYY-MM-DD or null",
  "overall_summary": "2-3 sentence overview of current health picture from these results.",
  "by_system": [
    {
      "system": "Iron & Ferritin",
      "markers": [
        {
          "name": "Hemoglobin",
          "value": 10.4,
          "unit": "g/dL",
          "reference": "12.0 - 17.0",
          "status": "low",
          "plain_language": "Hemoglobin carries oxygen in red blood cells. Yours is below the normal range, which can cause fatigue and breathlessness.",
          "change": "worsened",
          "previous_value": 11.2
        }
      ],
      "system_summary": "1-2 sentence summary of this body system."
    }
  ],
  "flags": [
    {
      "marker": "Hemoglobin",
      "status": "low",
      "note": "Below normal range. Worth discussing with your doctor.",
      "suggest_doctor_discussion": true
    }
  ],
  "improved": ["Marker names that improved since last report"],
  "worsened": ["Marker names that worsened since last report"],
  "stable": ["Marker names that stayed stable"],
  "questions_for_doctor": ["3-5 questions worth raising at your next appointment"],
  "confidence": 85,
  "disclaimer": "These results are for informational purposes only and are not a substitute for professional medical advice."
}`,
        },
      ],
      temperature: 0.2,
      maxOutputTokens: 4096,
    })

    return NextResponse.json({ ...result, has_data: true, report_count: reports.length })
  } catch (err) {
    console.error('[A4b] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}