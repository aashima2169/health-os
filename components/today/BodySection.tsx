// components/today/BodySection.tsx
// FIXED: Breathing (deep/shallow) restored — it existed in the original PRD's
// Nervous System section but was dropped during the v3 redesign.
'use client'

import SectionCard from '../shared/SectionCard'
import NumericInput from '../shared/NumericInput'
import EnergyPicker from '../shared/EnergyPicker'
import Toggle from '../shared/Toggle'
import type { BreathingType } from '../../types'

interface BodySectionProps {
  weight: number | ''
  sleep: number | ''
  energy: number | null
  brainFog: boolean
  watchedSunrise: boolean
  watchedSunset: boolean
  breathing: BreathingType | null
  groundingDone: boolean
  onWeightChange: (v: number | '') => void
  onSleepChange: (v: number | '') => void
  onEnergyChange: (v: number) => void
  onBrainFogChange: (v: boolean) => void
  onSunriseChange: (v: boolean) => void
  onSunsetChange: (v: boolean) => void
  onBreathingChange: (v: BreathingType | null) => void
  onGroundingChange: (v: boolean) => void
}

export default function BodySection({
  weight, sleep, energy, brainFog, watchedSunrise, watchedSunset,
  breathing, groundingDone,
  onWeightChange, onSleepChange, onEnergyChange,
  onBrainFogChange, onSunriseChange, onSunsetChange,
  onBreathingChange, onGroundingChange,
}: BodySectionProps) {
  const completed = (weight !== '' && Number(weight) > 0) ||
    (sleep !== '' && Number(sleep) > 0) || energy !== null

  const parts: string[] = []
  if (weight !== '' && Number(weight) > 0) parts.push(`${weight} kg`)
  if (sleep !== '' && Number(sleep) > 0) parts.push(`${sleep} hrs sleep`)
  if (energy) parts.push(['', 'Drained', 'Low', 'Okay', 'Good', 'High'][energy])
  const subtitle = parts.length ? parts.join(' · ') : 'How did you treat your body?'

  return (
    <SectionCard
      title="Body"
      titleEmoji="🩺"
      subtitle={subtitle}
      completed={completed}
      microcopy="Nice! You're showing up for yourself."
      defaultOpen={!completed}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <NumericInput
            label="Weight" value={weight} onChange={onWeightChange}
            placeholder="72.5" step={0.1} min={20} max={300} unit="kg"
          />
          <NumericInput
            label="Sleep" value={sleep} onChange={onSleepChange}
            placeholder="7.5" step={0.5} min={0} max={24} unit="hrs"
          />
        </div>

        <EnergyPicker value={energy} onChange={onEnergyChange} />

        {/* Breathing — single select deep/shallow */}
        <div>
          <p className="text-sm font-medium text-slate-500 mb-2">Breathing today</p>
          <div className="flex gap-2">
            {(['deep', 'shallow'] as BreathingType[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onBreathingChange(breathing === opt ? null : opt)}
                className={`flex-1 h-11 rounded-xl text-sm font-medium capitalize
                  transition-all duration-150
                  ${breathing === opt
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300'
                  }`}
              >
                {opt === 'deep' ? '🫁 Deep' : '💨 Shallow'}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-1">
          <Toggle
            emoji="🌫️"
            label="Brain fog today"
            description="Difficulty focusing or thinking clearly"
            checked={brainFog}
            onChange={onBrainFogChange}
          />
          <Toggle
            emoji="🌱"
            label="Grounding done"
            checked={groundingDone}
            onChange={onGroundingChange}
          />
          <Toggle
            emoji="🌅"
            label="Watched sunrise"
            checked={watchedSunrise}
            onChange={onSunriseChange}
          />
          <Toggle
            emoji="🌇"
            label="Watched sunset"
            checked={watchedSunset}
            onChange={onSunsetChange}
          />
        </div>
      </div>
    </SectionCard>
  )
}