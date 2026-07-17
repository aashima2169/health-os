// components/profile/MedicationsSection.tsx
'use client'

import { useRef, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import { daysBetween, todayISO } from '../../lib/date'
import type { Medication } from '../../types'

interface MedicationsSectionProps {
  medications: Medication[]
  onAdd: (payload: {
    name: string
    dosage: string | null
    frequency: string | null
    start_date: string | null
    end_date: string | null
    prescription_url: string | null
  }) => void
  onDelete: (id: string) => void
}

interface Draft {
  id: string
  name: string
  dosage: string
  frequency: string
  startDate: string
  endDate: string
}

export default function MedicationsSection({ medications, onAdd, onDelete }: MedicationsSectionProps) {
  // Manual add form
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')

  // Prescription upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null)

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({
      name: trimmed,
      dosage: dosage.trim() || null,
      frequency: frequency.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      prescription_url: null,
    })
    setName('')
    setDosage('')
    setFrequency('')
    setStartDate(todayISO())
    setEndDate('')
  }

  const handleFileSelected = async (file: File) => {
    setUploading(true)
    setUploadWarning(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/medications/extract', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        setUploadWarning(json.error ?? "Couldn't process this prescription.")
        return
      }

      const extracted: { name: string; dosage: string | null; frequency: string | null }[] = json.medications ?? []
      setDrafts(extracted.map((m, i) => ({
        id: `${Date.now()}-${i}`,
        name: m.name,
        dosage: m.dosage ?? '',
        frequency: m.frequency ?? '',
        startDate: todayISO(),
        endDate: '',
      })))
      setPrescriptionUrl(json.prescription_url ?? null)
      if (json.warning) setUploadWarning(json.warning)
    } catch {
      setUploadWarning("Couldn't reach the server — try again.")
    } finally {
      setUploading(false)
    }
  }

  const updateDraft = (id: string, field: keyof Omit<Draft, 'id'>, value: string) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)))
  }

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const handleAddAllDrafts = () => {
    if (drafts.length === 0) return
    drafts.forEach((d) => {
      if (!d.name.trim()) return
      onAdd({
        name: d.name.trim(),
        dosage: d.dosage.trim() || null,
        frequency: d.frequency.trim() || null,
        start_date: d.startDate || null,
        end_date: d.endDate || null,
        prescription_url: prescriptionUrl,
      })
    })
    setDrafts([])
    setPrescriptionUrl(null)
    setUploadWarning(null)
  }

  return (
    <SectionCard title="Existing Medications" titleEmoji="💊" subtitle={`${medications.length} logged`}>
      <div className="space-y-3">
        {medications.map((m) => {
          const start = m.start_date ? new Date(m.start_date + 'T00:00:00') : null
          const end = m.end_date ? new Date(m.end_date + 'T00:00:00') : null
          const days = start && end
            ? daysBetween(m.start_date!, m.end_date!) + 1
            : start
              ? daysBetween(m.start_date!, todayISO()) + 1
              : null
          return (
            <div
              key={m.id}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
                flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {m.name}{m.dosage ? ` · ${m.dosage}` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {m.frequency ? `${m.frequency} · ` : ''}
                  {!start && 'Not started yet'}
                  {start && start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {start && end
                    ? ` – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${days} days`
                    : start && ` · Ongoing · ${days} days so far`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                className="text-xs text-red-400 font-medium flex-shrink-0"
              >
                Delete
              </button>
            </div>
          )
        })}

        {/* ── Upload prescription ─────────────────────────────── */}
        <div className="border-t border-slate-100 pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-11 rounded-xl border border-dashed border-blue-300 bg-blue-50
              text-sm font-semibold text-blue-600 disabled:opacity-50"
          >
            {uploading ? 'Reading prescription…' : '📄 Upload a prescription to auto-fill'}
          </button>
          {uploadWarning && (
            <p className="text-xs text-amber-600 mt-2">{uploadWarning}</p>
          )}
        </div>

        {/* ── Extracted drafts, pending review ────────────────── */}
        {drafts.length > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-blue-700">
              Found {drafts.length} medication{drafts.length === 1 ? '' : 's'} — review and add
            </p>

            {drafts.map((d) => (
              <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) => updateDraft(d.id, 'name', e.target.value)}
                    placeholder="Medication name"
                    className="flex-1 h-10 px-3 rounded-lg border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeDraft(d.id)}
                    className="text-xs text-red-400 font-medium flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={d.dosage}
                    onChange={(e) => updateDraft(d.id, 'dosage', e.target.value)}
                    placeholder="Dosage"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
                  />
                  <input
                    type="text"
                    value={d.frequency}
                    onChange={(e) => updateDraft(d.id, 'frequency', e.target.value)}
                    placeholder="Frequency"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 mb-1">Start date</p>
                    <input
                      type="date"
                      value={d.startDate}
                      onChange={(e) => updateDraft(d.id, 'startDate', e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 mb-1">End date</p>
                    <input
                      type="date"
                      value={d.endDate}
                      min={d.startDate || undefined}
                      onChange={(e) => updateDraft(d.id, 'endDate', e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}

            <p className="text-[11px] text-slate-500">
              Leave start date empty if you haven&apos;t started yet (e.g. begins in a few days), and end date empty if ongoing.
            </p>

            <button
              type="button"
              onClick={handleAddAllDrafts}
              disabled={drafts.every((d) => !d.name.trim())}
              className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Add {drafts.length} medication{drafts.length === 1 ? '' : 's'}
            </button>
          </div>
        )}

        {/* ── Manual add form ──────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-slate-400">Or add one manually</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Medication name"
            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
              text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="Dosage (e.g. 500mg)"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
            />
            <input
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="Frequency (e.g. twice daily)"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Start date</p>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">End date</p>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Leave start date empty if you haven&apos;t started yet, and end date empty if ongoing.
          </p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name.trim()}
            className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Add medication
          </button>
        </div>
      </div>
    </SectionCard>
  )
}
