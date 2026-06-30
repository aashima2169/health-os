// components/today/NervousSystemSection.tsx
'use client'

import SectionCard from '../shared/SectionCard'
import Toggle from '../shared/Toggle'
import type { BreathingType } from '../../types'

interface NervousSystemSectionProps {
  breathing: BreathingType | null
  grounding: boolean
  onBreathingChange: (val: BreathingType | null) => void
  onGroundingChange: (val: boolean) => void
}

export default function NervousSystemSection({
  breathing,
  grounding,
  onBreathingChange,
  onGroundingChange,
}: NervousSystemSectionProps) {
  const completed = breathing !== null || grounding

  const subtitleParts: string[] = []
  if (breathing) subtitleParts.push(`${breathing} breathing`)
  if (grounding) subtitleParts.push('grounded')
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'Tap to log'

  return (
    <SectionCard title="Nervous System" subtitle={subtitle} completed={completed}>
      {/* Breathing - single select */}
      <div className="mb-4">
        <p className="text-sm font-medium text-slate-500 mb-2">Breathing today</p>
        <div className="flex gap-2">
          {(['deep', 'shallow'] as BreathingType[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onBreathingChange(breathing === opt ? null : opt)}
              className={`
                flex-1 h-11 rounded-xl text-sm font-medium capitalize transition-all duration-150
                ${
                  breathing === opt
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300'
                }
              `}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Grounding - checkbox */}
      <div className="border-t border-slate-100 pt-3">
        <Toggle
          label="Grounding done"
          checked={grounding}
          onChange={onGroundingChange}
        />
      </div>
    </SectionCard>
  )
}