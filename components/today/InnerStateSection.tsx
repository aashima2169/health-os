// components/today/InnerStateSection.tsx
'use client'

import { useEffect, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import Chip from '../shared/Chip'
import { getMasters } from '../../lib/db'

interface InnerStateSectionProps {
  selected: string[]
  onChange: (v: string[]) => void
}

export default function InnerStateSection({ selected, onChange }: InnerStateSectionProps) {
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => { getMasters('mental_state').then(setOptions) }, [])

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s])

  const completed = selected.length > 0
  const subtitle = completed ? selected.join(' · ') : 'How are you feeling inside?'

  return (
    <SectionCard
      title="Inner State"
      titleEmoji="💭"
      subtitle={subtitle}
      completed={completed}
      microcopy="Naming it helps."
    >
      <p className="text-xs text-slate-400 mb-3">Select all that feel true right now</p>
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