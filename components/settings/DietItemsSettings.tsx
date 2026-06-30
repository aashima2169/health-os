// components/settings/DietItemsSettings.tsx
// UPDATED: now imports from '../../lib/db' (consolidated) instead of
// '../../lib/db.meal-items' — delete db.meal-items.ts, it's no longer used.
'use client'

import { useEffect, useState } from 'react'
import { getAllMealItems, addMealItem, deleteMealItem } from '../../lib/db'
import type { MealSlot } from '../../types'

const SLOTS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙' },
  { key: 'snacks',    label: 'Snacks',    emoji: '🍎' },
]

export default function DietItemsSettings() {
  const [items, setItems] = useState<Record<MealSlot, string[]>>({
    breakfast: [], lunch: [], dinner: [], snacks: [],
  })
  const [newValues, setNewValues] = useState<Record<MealSlot, string>>({
    breakfast: '', lunch: '', dinner: '', snacks: '',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllMealItems().then((data) => { setItems(data); setLoading(false) })
  }, [])

  const handleAdd = async (slot: MealSlot) => {
    const val = newValues[slot].trim()
    if (!val) return
    await addMealItem(slot, val)
    setItems((prev) => ({ ...prev, [slot]: [...prev[slot], val] }))
    setNewValues((prev) => ({ ...prev, [slot]: '' }))
  }

  const handleDelete = async (slot: MealSlot, item: string) => {
    await deleteMealItem(slot, item)
    setItems((prev) => ({ ...prev, [slot]: prev[slot].filter((i) => i !== item) }))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {SLOTS.map(({ key, label, emoji }) => (
        <MealItemGroup
          key={key}
          slotKey={key}
          label={label}
          emoji={emoji}
          items={items[key]}
          newValue={newValues[key]}
          onNewValueChange={(v) => setNewValues((prev) => ({ ...prev, [key]: v }))}
          onAdd={() => handleAdd(key)}
          onDelete={(item) => handleDelete(key, item)}
        />
      ))}
    </div>
  )
}

function MealItemGroup({
  slotKey, label, emoji, items, newValue, onNewValueChange, onAdd, onDelete,
}: {
  slotKey: MealSlot
  label: string
  emoji: string
  items: string[]
  newValue: string
  onNewValueChange: (v: string) => void
  onAdd: () => void
  onDelete: (item: string) => void
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
            <p className="text-xs text-slate-400">{items.length} saved items</p>
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
            {items.map((item) => (
              <div key={item} className="flex items-center gap-1.5 bg-slate-50 border
                border-slate-200 rounded-full px-3 py-1.5">
                <span className="text-sm text-slate-700">{item}</span>
                <button type="button" onClick={() => onDelete(item)}
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
            <input
              type="text" value={newValue}
              onChange={(e) => onNewValueChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }}
              placeholder={`Add a ${label.toLowerCase()} item…`}
              className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50
                text-sm text-slate-900 placeholder:text-slate-300
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="button" onClick={onAdd} disabled={!newValue.trim()}
              className="h-11 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold
                disabled:opacity-40 transition-opacity">
              Add
            </button>
          </div>

          <p className="text-[11px] text-slate-400 pt-1">
            These appear as quick-add chips in the Diet section. Tap one while logging
            and just type the quantity after it — e.g. tap "Roti" then type "- 2".
          </p>
        </div>
      )}
    </div>
  )
}