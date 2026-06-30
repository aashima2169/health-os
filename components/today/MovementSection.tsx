// components/today/MovementSection.tsx
'use client'

import { useEffect, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import Chip from '../shared/Chip'
import { getMasters } from '../../lib/db'

interface MovementSectionProps {
  selected: string[]
  onChange: (v: string[]) => void
}

export default function MovementSection({ selected, onChange }: MovementSectionProps) {
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => { getMasters('exercise_type').then(setOptions) }, [])

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s])

  const completed = selected.length > 0
  const subtitle = completed ? selected.join(' · ') : 'Did you move your body today?'

  return (
    <SectionCard
      title="Movement"
      titleEmoji="🏃"
      subtitle={subtitle}
      completed={completed}
      microcopy="Every bit of movement counts."
    >
      <p className="text-xs text-slate-400 mb-3">
        Select everything you did — even a short walk counts
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={selected.includes(opt)}
            onToggle={() => toggle(opt)}
          />
        ))}
      </div>
      {selected.length === 0 && (
        <button
          type="button"
          onClick={() => onChange(['Rest day'])}
          className="mt-3 text-xs text-slate-400 underline underline-offset-2"
        >
          Rest day — that's okay too
        </button>
      )}
    </SectionCard>
  )
}