// components/profile/ConditionsSection.tsx
'use client'

import { useState } from 'react'
import SectionCard from '../shared/SectionCard'
import type { ProfileCondition } from '../../types'

interface ConditionsSectionProps {
  conditions: ProfileCondition[]
  onAdd: (payload: { condition_name: string; diagnosed_date: string | null; notes: string | null }) => void
  onDelete: (id: string) => void
}

export default function ConditionsSection({ conditions, onAdd, onDelete }: ConditionsSectionProps) {
  const [name, setName] = useState('')
  const [diagnosedDate, setDiagnosedDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleAdd = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ condition_name: trimmed, diagnosed_date: diagnosedDate || null, notes: notes.trim() || null })
    setName('')
    setDiagnosedDate('')
    setNotes('')
  }

  return (
    <SectionCard title="Existing Conditions" titleEmoji="🩹" subtitle={`${conditions.length} logged`}>
      <div className="space-y-3">
        {conditions.map((c) => (
          <div
            key={c.id}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
              flex items-start justify-between gap-3"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">{c.condition_name}</p>
              {c.diagnosed_date && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Diagnosed {new Date(c.diagnosed_date + 'T00:00:00').toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
              {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              className="text-xs text-red-400 font-medium flex-shrink-0"
            >
              Delete
            </button>
          </div>
        ))}

        <div className="border-t border-slate-100 pt-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Condition name (e.g. IBS)"
            className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
              text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={diagnosedDate}
              onChange={(e) => setDiagnosedDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name.trim()}
            className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Add condition
          </button>
        </div>
      </div>
    </SectionCard>
  )
}
