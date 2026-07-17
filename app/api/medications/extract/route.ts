// app/api/medications/extract/route.ts
// Upload a prescription (image or PDF), store it, and extract the
// medications listed on it. Mirrors app/api/blood-reports/route.ts's
// upload → store → extract flow.
import { NextRequest, NextResponse } from 'next/server'
import { extractPrescription } from '../../../../lib/extractPrescription'
import { createRequestClient } from '../../../../lib/supabaseServer'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const client = await createRequestClient()

    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const fileBuffer = await file.arrayBuffer()

    const { data: storageData, error: storageError } = await client.storage
      .from('prescriptions')
      .upload(fileName, fileBuffer, { contentType: file.type })

    if (storageError) {
      console.error('[medications/extract] storage error:', storageError)
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 })
    }

    const { data: urlData } = client.storage
      .from('prescriptions').getPublicUrl(storageData.path)
    const prescriptionUrl = urlData.publicUrl

    const base64 = Buffer.from(fileBuffer).toString('base64')
    const { medications, extractionError } = await extractPrescription(base64, file.type, client)

    return NextResponse.json({
      medications,
      prescription_url: prescriptionUrl,
      warning: extractionError
        ? `Couldn't read medications from this file: ${extractionError}. You can still add them manually.`
        : undefined,
    })
  } catch (err) {
    console.error('[medications/extract] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
