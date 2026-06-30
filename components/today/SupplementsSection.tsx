// components/today/SupplementsSection.tsx
'use client'

import { useEffect, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import Chip from '../shared/Chip'
import { getMasters } from '../../lib/db'

interface SupplementsSectionProps {
  selected: string[]
  onChange: (v: string[]) => void
}

export default function SupplementsSection({ selected, onChange }: SupplementsSectionProps) {
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => { getMasters('supplement').then(setOptions) }, [])

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s])

  const completed = selected.length > 0
  const subtitle = completed ? `${selected.length} taken` : 'Did you take your supplements?'

  return (
    <SectionCard
      title="Supplements"
      titleEmoji="💊"
      subtitle={subtitle}
      completed={completed}
      microcopy="Consistency adds up over time."
    >
      <p className="text-xs text-slate-400 mb-3">Tap everything you took today</p>
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
    </SectionCard>
  )
}