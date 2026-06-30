// components/today/RecoverySection.tsx
'use client'

import { useEffect, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import Chip from '../shared/Chip'
import { getMasters } from '../../lib/db'

interface RecoverySectionProps {
  selected: string[]
  onChange: (v: string[]) => void
}

export default function RecoverySection({ selected, onChange }: RecoverySectionProps) {
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => { getMasters('recovery_activity').then(setOptions) }, [])

  const toggle = (s: string) =>
    onChange(selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s])

  const completed = selected.length > 0
  const subtitle = completed ? selected.join(' · ') : 'What supported your nervous system?'

  return (
    <SectionCard
      title="Recovery"
      titleEmoji="🌿"
      subtitle={subtitle}
      completed={completed}
      microcopy="Recovery is productive."
    >
      <p className="text-xs text-slate-400 mb-3">
        Select all recovery activities from today
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
    </SectionCard>
  )
}