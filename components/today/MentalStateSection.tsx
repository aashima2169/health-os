// components/today/MentalStateSection.tsx
'use client'

import { useEffect, useState } from 'react'
import SectionCard from '../shared/SectionCard'
import Chip from '../shared/Chip'
import { getMasters } from '../../lib/db'

interface MentalStateSectionProps {
  selected: string[]
  onChange: (states: string[]) => void
}

export default function MentalStateSection({ selected, onChange }: MentalStateSectionProps) {
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    getMasters('mental_state').then(setOptions)
  }, [])

  const toggle = (state: string) => {
    onChange(
      selected.includes(state) ? selected.filter((s) => s !== state) : [...selected, state]
    )
  }

  const completed = selected.length > 0
  const subtitle = completed ? selected.join(', ') : 'Tap to log'

  return (
    <SectionCard title="Mental State" subtitle={subtitle} completed={completed}>
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