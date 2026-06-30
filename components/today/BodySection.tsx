// components/today/BodySection.tsx
'use client'

import SectionCard from '../shared/SectionCard'
import NumericInput from '../shared/NumericInput'
import EnergyPicker from '../shared/EnergyPicker'
import Toggle from '../shared/Toggle'

interface BodySectionProps {
  weight: number | ''
  sleep: number | ''
  energy: number | null
  brainFog: boolean
  watchedSunrise: boolean
  watchedSunset: boolean
  onWeightChange: (v: number | '') => void
  onSleepChange: (v: number | '') => void
  onEnergyChange: (v: number) => void
  onBrainFogChange: (v: boolean) => void
  onSunriseChange: (v: boolean) => void
  onSunsetChange: (v: boolean) => void
}

export default function BodySection({
  weight, sleep, energy, brainFog, watchedSunrise, watchedSunset,
  onWeightChange, onSleepChange, onEnergyChange,
  onBrainFogChange, onSunriseChange, onSunsetChange,
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

        <div className="border-t border-slate-100 pt-3 space-y-1">
          <Toggle
            emoji="🌫️"
            label="Brain fog today"
            description="Difficulty focusing or thinking clearly"
            checked={brainFog}
            onChange={onBrainFogChange}
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