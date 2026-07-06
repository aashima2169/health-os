// app/api/blood-reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { supabase } from '../../../lib/supabase'
import { extractMarkersFromPDF } from '../../../lib/extractMarkers'
import { regenerateBloodIntelligence } from '../../../lib/agents/bloodIntelligence'

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

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const fileBuffer = await file.arrayBuffer()

    const { data: storageData, error: storageError } = await supabase.storage
      .from('blood-reports')
      .upload(fileName, fileBuffer, { contentType: 'application/pdf' })

    if (storageError) {
      console.error('[blood-reports] storage error:', storageError)
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('blood-reports').getPublicUrl(storageData.path)
    const fileUrl = urlData.publicUrl

    const base64PDF = Buffer.from(fileBuffer).toString('base64')
    const { markers, extractionError } = await extractMarkersFromPDF(base64PDF)

    const { data: report, error: dbError } = await supabase
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

    // waitUntil keeps this alive past the response — a bare fire-and-forget
    // (.catch() without await, no waitUntil) gets killed by Vercel the
    // instant this response is sent, so the regeneration would silently
    // never complete.
    if (!extractionError) {
      waitUntil(
        regenerateBloodIntelligence().catch((err) =>
          console.error('[blood-reports] A1 regeneration after upload failed:', err),
        )
      )
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