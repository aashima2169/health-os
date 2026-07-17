// app/api/blood-reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { extractMarkersFromPDF } from '../../../lib/extractMarkers'
import { invalidateAgents } from '../../../lib/agents/store'
import { SPECIALIST_AGENT_IDS } from '../../../lib/agents/specialistBoard'
import { createRequestClient } from '../../../lib/supabaseServer'

export const maxDuration = 280

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const reportDate = formData.get('report_date') as string | null
    const notes = (formData.get('notes') as string | null) ?? ''

    if (!file || !reportDate) {
      return NextResponse.json({ error: 'file and report_date are required' }, { status: 400 })
    }

    const client = await createRequestClient()

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const fileBuffer = await file.arrayBuffer()

    const { data: storageData, error: storageError } = await client.storage
      .from('blood-reports')
      .upload(fileName, fileBuffer, { contentType: 'application/pdf' })

    if (storageError) {
      console.error('[blood-reports] storage error:', storageError)
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data: urlData } = client.storage
      .from('blood-reports').getPublicUrl(storageData.path)
    const fileUrl = urlData.publicUrl

    const base64PDF = Buffer.from(fileBuffer).toString('base64')
    const { markers, extractionError } = await extractMarkersFromPDF(base64PDF, client)

    const { data: report, error: dbError } = await client
      .from('blood_reports')
      .insert({
        report_date: reportDate,
        file_url: fileUrl,
        markers,
        notes,
        extraction_status: extractionError ? 'failed' : 'success',
        extraction_error: extractionError ?? null,
      })
      .select()
      .single()

    if (dbError) {
      console.error('[blood-reports] db error:', dbError)
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 })
    }

    // AI analysis is fully manual now — Refresh on Insights is the only
    // trigger. A new report still invalidates every cached read it could
    // have affected, so the next Refresh recomputes from fresh data
    // instead of reusing a now-stale cache; it just doesn't spend a Gemini
    // call automatically on upload.
    if (!extractionError) {
      await invalidateAgents(client, ['A1', ...SPECIALIST_AGENT_IDS, 'A3'])
    }

    return NextResponse.json({
      report,
      warning: extractionError
        ? `Marker extraction failed: ${extractionError}. PDF saved — tap Retry on the report.`
        : undefined,
    })
  } catch (err) {
    console.error('[blood-reports POST] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const client = await createRequestClient()
    const { data, error } = await client
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
    const client = await createRequestClient()
    if (file_url) {
      const path = file_url.split('/blood-reports/')[1]
      if (path) await client.storage.from('blood-reports').remove([path])
    }
    await client.from('blood_reports').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[blood-reports DELETE] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
