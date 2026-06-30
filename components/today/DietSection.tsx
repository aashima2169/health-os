// components/today/DietSection.tsx
'use client'

import { useEffect, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import Chip from '../shared/Chip'
import { getOutsideReasons, getMealItems } from '../../lib/db'
import type { DietState, MealSlot, MealLocation } from '../../types'

const SLOTS: { key: MealSlot; label: string; emoji: string; placeholder: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅', placeholder: 'e.g. 2 eggs + paratha' },
  { key: 'lunch',     label: 'Lunch',     emoji: '☀️', placeholder: 'e.g. Chicken curry + roti' },
  { key: 'dinner',    label: 'Dinner',    emoji: '🌙', placeholder: 'e.g. Khichdi + papad' },
  { key: 'snacks',    label: 'Snacks',    emoji: '🍎', placeholder: 'e.g. Watermelon, chai' },
]

interface DietSectionProps {
  diet: DietState
  onChange: (v: DietState) => void
}

export default function DietSection({ diet, onChange }: DietSectionProps) {
  const [outsideReasons, setOutsideReasons] = useState<string[]>([])
  const [mealItems, setMealItems] = useState<Record<MealSlot, string[]>>({
    breakfast: [], lunch: [], dinner: [], snacks: [],
  })

  useEffect(() => {
    getOutsideReasons().then(setOutsideReasons)
    Promise.all([
      getMealItems('breakfast'),
      getMealItems('lunch'),
      getMealItems('dinner'),
      getMealItems('snacks'),
    ]).then(([b, l, d, s]) => {
      setMealItems({ breakfast: b, lunch: l, dinner: d, snacks: s })
    })
  }, [])

  const update = (slot: MealSlot, patch: Partial<DietState[MealSlot]>) =>
    onChange({ ...diet, [slot]: { ...diet[slot], ...patch } })

  // Quick-add an item: appends "ItemName - " to the description so the user
  // just types the quantity after it.
  const quickAdd = (slot: MealSlot, item: string) => {
    const current = diet[slot].description
    const sep = current.trim() ? (current.trim().endsWith(',') ? ' ' : ', ') : ''
    update(slot, { description: `${current}${current.trim() ? sep : ''}${item} - ` })
  }

  const filled = SLOTS.filter((s) => diet[s.key].description.trim()).length
  const completed = filled > 0
  const subtitle = completed ? `${filled} of 4 meals logged` : 'What did you eat yesterday?'

  return (
    <SectionCard
      title="Diet"
      titleEmoji="🍽️"
      subtitle={subtitle}
      completed={completed}
      microcopy="You're building clarity every day."
    >
      <p className="text-xs text-slate-400 mb-4">
        Log yesterday's meals — tap a saved item to quick-add it, then type the quantity.
      </p>
      <div className="space-y-5">
        {SLOTS.map(({ key, label, emoji, placeholder }) => (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-6">{emoji}</span>
              <span className="text-sm font-semibold text-slate-700 leading-6">{label}</span>
            </div>

            {/* Home / Outside */}
            <div className="flex gap-2 mb-2">
              {(['home', 'outside'] as MealLocation[]).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => update(key, {
                    location: loc,
                    outside_reason: loc === 'home' ? '' : diet[key].outside_reason,
                  })}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all
                    ${diet[key].location === loc
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 border border-slate-200'}`}
                >
                  {loc === 'home' ? '🏠 Home' : '🏪 Outside'}
                </button>
              ))}
            </div>

            {/* Outside reason */}
            {diet[key].location === 'outside' && outsideReasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {outsideReasons.map((r) => (
                  <Chip
                    key={r} label={r} size="sm"
                    selected={diet[key].outside_reason === r}
                    onToggle={() => update(key, {
                      outside_reason: diet[key].outside_reason === r ? '' : r,
                    })}
                  />
                ))}
              </div>
            )}

            {/* Quick-add saved items */}
            {mealItems[key].length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {mealItems[key].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => quickAdd(key, item)}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50
                      text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <textarea
              value={diet[key].description}
              onChange={(e) => update(key, { description: e.target.value })}
              placeholder={placeholder} rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50
                text-sm text-slate-900 placeholder:text-slate-300 resize-none
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {key !== 'snacks' && <div className="w-full h-px bg-slate-100 mt-4" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}