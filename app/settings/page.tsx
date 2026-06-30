// app/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getMasters, addMaster, deleteMaster } from '../../lib/db'
import DietItemsSettings from '../../components/settings/DietItemsSettings'
import type { MasterCategory } from '../../types'

const CATEGORIES: { key: MasterCategory; label: string; emoji: string }[] = [
  { key: 'mental_state',      label: 'Inner States',       emoji: '💭' },
  { key: 'exercise_type',     label: 'Movement Types',     emoji: '🏃' },
  { key: 'recovery_activity', label: 'Recovery Activities',emoji: '🌿' },
  { key: 'supplement',        label: 'Supplements',        emoji: '💊' },
  { key: 'outside_reason',    label: 'Outside Food Reasons', emoji: '🏪' },
  { key: 'health_event_type', label: 'Health Event Types', emoji: '⚡' },
  { key: 'body_location',     label: 'Body Locations',     emoji: '📍' },
]

export default function SettingsPage() {
  const [masterData, setMasterData] = useState<Record<MasterCategory, string[]>>(
    {} as Record<MasterCategory, string[]>
  )
  const [newValues, setNewValues] = useState<Record<MasterCategory, string>>(
    {} as Record<MasterCategory, string>
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const results = await Promise.all(
        CATEGORIES.map((c) => getMasters(c.key).then((vals) => [c.key, vals] as const))
      )
      setMasterData(Object.fromEntries(results) as Record<MasterCategory, string[]>)
      setLoading(false)
    }
    load()
  }, [])

  const handleAdd = async (category: MasterCategory) => {
    const val = (newValues[category] ?? '').trim()
    if (!val) return
    await addMaster(category, val)
    setMasterData((prev) => ({ ...prev, [category]: [...(prev[category] ?? []), val] }))
    setNewValues((prev) => ({ ...prev, [category]: '' }))
  }

  const handleDelete = async (category: MasterCategory, value: string) => {
    await deleteMaster(category, value)
    setMasterData((prev) => ({
      ...prev, [category]: (prev[category] ?? []).filter((v) => v !== value),
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
          Settings
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Customise</h1>
        <p className="text-sm text-slate-400 mt-1">
          Add, edit or remove options from any list.
        </p>
      </div>

      <div className="px-4 space-y-6">

        {/* ── Diet Items (special section, separate component) ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">
            Diet — Quick Add Items
          </p>
          <DietItemsSettings />
        </div>

        {/* ── Standard master lists ──────────────────────────── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">
            Other Lists
          </p>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => (
              <MasterSection
                key={cat.key}
                category={cat.key}
                label={cat.label}
                emoji={cat.emoji}
                values={masterData[cat.key] ?? []}
                newValue={newValues[cat.key] ?? ''}
                onNewValueChange={(v) => setNewValues((prev) => ({ ...prev, [cat.key]: v }))}
                onAdd={() => handleAdd(cat.key)}
                onDelete={(v) => handleDelete(cat.key, v)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MasterSection({
  category, label, emoji, values, newValue, onNewValueChange, onAdd, onDelete,
}: {
  category: MasterCategory
  label: string
  emoji: string
  values: string[]
  newValue: string
  onNewValueChange: (v: string) => void
  onAdd: () => void
  onDelete: (v: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{emoji}</span>
          <div className="text-left">
            <p className="font-semibold text-[15px] text-slate-900">{label}</p>
            <p className="text-xs text-slate-400">{values.length} items</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {values.map((val) => (
              <div key={val} className="flex items-center gap-1.5 bg-slate-50 border
                border-slate-200 rounded-full px-3 py-1.5">
                <span className="text-sm text-slate-700">{val}</span>
                <button type="button" onClick={() => onDelete(val)}
                  className="w-4 h-4 text-slate-400 hover:text-red-500 flex items-center
                    justify-center transition-colors">
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <input type="text" value={newValue}
              onChange={(e) => onNewValueChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }}
              placeholder={`Add to ${label.toLowerCase()}…`}
              className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                text-sm text-slate-900 placeholder:text-slate-300
                focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={onAdd} disabled={!newValue.trim()}
              className="h-11 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold
                disabled:opacity-40 transition-opacity">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Periods link tucked into Settings too, since it's not in bottom nav */}
    </div>
  )
}