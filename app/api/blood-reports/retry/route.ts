// app/api/blood-reports/retry/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { extractMarkersFromPDF } from '../../../../lib/extractMarkers'

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: report, error: fetchError } = await supabase
      .from('blood_reports').select('*').eq('id', id).single()

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (!report.file_url) {
      return NextResponse.json({ error: 'No file URL stored for this report' }, { status: 400 })
    }

    const pdfRes = await fetch(report.file_url)
    if (!pdfRes.ok) {
      return NextResponse.json({ error: `Could not fetch PDF: ${pdfRes.status}` }, { status: 500 })
    }

    const base64PDF = Buffer.from(await pdfRes.arrayBuffer()).toString('base64')
    const { markers, extractionError } = await extractMarkersFromPDF(base64PDF)

    const { data: updated, error: updateError } = await supabase
      .from('blood_reports')
      .update({
        markers,
        extraction_status: extractionError ? 'failed' : 'success',
        extraction_error: extractionError ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[blood-reports retry] update error:', updateError)
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    return NextResponse.json({
      report: updated,
      warning: extractionError ? `Retry also failed: ${extractionError}` : undefined,
    })
  } catch (err) {
    console.error('[blood-reports retry] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}