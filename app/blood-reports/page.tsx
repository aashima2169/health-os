// app/blood-reports/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { BloodReport } from '../../types'

interface MarkerEntry {
  value: number
  unit: string
  reference?: string
}

export default function BloodReportsPage() {
  const [reports, setReports] = useState<BloodReport[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [reportDate, setReportDate] = useState('')
  const [notes, setNotes] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadReports() {
    setLoading(true)
    try {
      const res = await fetch('/api/blood-reports')
      const json = await res.json()
      setReports(json.reports ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReports() }, [])

  async function handleUpload() {
    if (!selectedFile || !reportDate) {
      setUploadError('Please select a PDF and enter the test date.')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      form.append('report_date', reportDate)
      form.append('notes', notes)

      const res = await fetch('/api/blood-reports', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')

      setSelectedFile(null)
      setReportDate('')
      setNotes('')
      setShowUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadReports()
    } catch (err) {
      setUploadError('Upload failed. Check your Gemini API key and Supabase storage settings.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(report: BloodReport) {
    if (!confirm('Delete this report?')) return
    await fetch('/api/blood-reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: report.id, file_url: report.file_url }),
    })
    setReports((r) => r.filter((x) => x.id !== report.id))
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-28">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
            Blood Reports
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Lab Results</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center shadow-md shadow-blue-200"
        >
          <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-4 space-y-3">
        {/* Upload panel */}
        {showUpload && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm px-5 py-5">
            <p className="font-semibold text-slate-900 mb-4">Upload New Report</p>

            {/* Date */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Date tests were done
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="
                  w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                  text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                "
              />
            </div>

            {/* File picker */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                PDF file
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="
                  w-full h-20 rounded-xl border-2 border-dashed border-slate-200
                  flex flex-col items-center justify-center gap-1 cursor-pointer
                  hover:border-blue-400 transition-colors
                "
              >
                {selectedFile ? (
                  <>
                    <span className="text-2xl">📄</span>
                    <span className="text-sm text-slate-700 font-medium">{selectedFile.name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">⬆️</span>
                    <span className="text-sm text-slate-400">Tap to select PDF</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Fasting report, Apollo Diagnostics"
                className="
                  w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                  text-slate-900 text-sm placeholder:text-slate-300
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                "
              />
            </div>

            {uploadError && (
              <p className="text-sm text-red-500 mb-3">{uploadError}</p>
            )}

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="
                w-full h-12 rounded-xl bg-blue-600 text-white font-semibold text-sm
                disabled:opacity-60 transition-opacity
              "
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading & extracting markers…
                </span>
              ) : (
                'Upload & Extract Markers'
              )}
            </button>

            {uploading && (
              <p className="text-xs text-slate-400 text-center mt-2">
                Gemini is reading your report. This takes 10–20 seconds.
              </p>
            )}
          </div>
        )}

        {/* Reports list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🩸</p>
            <p className="font-medium text-slate-700">No reports yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Tap + above to upload your first blood report.
            </p>
          </div>
        ) : (
          reports.map((report) => (
            <ReportCard key={report.id} report={report} onDelete={() => handleDelete(report)} />
          ))
        )}
      </div>
    </div>
  )
}

function ReportCard({
  report,
  onDelete,
}: {
  report: BloodReport
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const markers = report.markers as Record<string, MarkerEntry> | null
  const markerEntries = markers ? Object.entries(markers) : []

  const displayDate = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-lg">🩸</span>
          </div>
          <div className="text-left">
            <p className="font-semibold text-[15px] text-slate-900">{displayDate}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {markerEntries.length} markers extracted
              {report.notes ? ` · ${report.notes}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report.file_url && (
            <a
              href={report.file_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-600 font-medium"
            >
              PDF
            </a>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16" fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          {markerEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No markers could be extracted from this report.</p>
          ) : (
            <div className="space-y-2">
              {markerEntries.map(([name, data]) => (
                <MarkerRow key={name} name={name} data={data} />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="mt-5 text-xs text-red-400 font-medium"
          >
            Delete report
          </button>
        </div>
      )}
    </div>
  )
}

function MarkerRow({ name, data }: { name: string; data: MarkerEntry }) {
  // Simple out-of-range detection
  let status: 'normal' | 'unknown' = 'unknown'
  if (data.reference) {
    const match = data.reference.match(/([\d.]+)\s*[-–]\s*([\d.]+)/)
    if (match) {
      const low = parseFloat(match[1])
      const high = parseFloat(match[2])
      if (data.value >= low && data.value <= high) status = 'normal'
    }
  }

  const isOutOfRange =
    data.reference
      ? (() => {
          const match = data.reference.match(/([\d.]+)\s*[-–]\s*([\d.]+)/)
          if (!match) return false
          const low = parseFloat(match[1])
          const high = parseFloat(match[2])
          return data.value < low || data.value > high
        })()
      : false

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isOutOfRange ? 'bg-orange-400' : 'bg-green-400'
          }`}
        />
        <span className="text-sm text-slate-700">{name}</span>
      </div>
      <div className="text-right">
        <span className={`text-sm font-semibold ${isOutOfRange ? 'text-orange-500' : 'text-slate-900'}`}>
          {data.value} {data.unit}
        </span>
        {data.reference && (
          <p className="text-[10px] text-slate-400">{data.reference}</p>
        )}
      </div>
    </div>
  )
}