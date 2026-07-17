// components/profile/DemographicsSection.tsx
'use client'

import SectionCard from '../shared/SectionCard'
import NumericInput from '../shared/NumericInput'
import type { Gender, MenstruatingStatus } from '../../types'

interface DemographicsSectionProps {
  gender: Gender | null
  age: number | ''
  city: string
  menstruatingStatus: MenstruatingStatus | null
  saving: boolean
  onGenderChange: (v: Gender | null) => void
  onAgeChange: (v: number | '') => void
  onCityChange: (v: string) => void
  onMenstruatingStatusChange: (v: MenstruatingStatus | null) => void
  onSave: () => void
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const MENSTRUATING_OPTIONS: { value: MenstruatingStatus; label: string }[] = [
  { value: 'menstruating', label: 'Menstruating' },
  { value: 'not_menstruating', label: 'Not menstruating' },
]

export default function DemographicsSection({
  gender, age, city, menstruatingStatus, saving,
  onGenderChange, onAgeChange, onCityChange, onMenstruatingStatusChange, onSave,
}: DemographicsSectionProps) {
  return (
    <SectionCard
      title="Demographics"
      titleEmoji="🧑"
      subtitle="Static facts that help us reason about your data"
      defaultOpen
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-2">Gender</p>
          <div className="grid grid-cols-2 gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onGenderChange(gender === opt.value ? null : opt.value)}
                className={`h-11 rounded-xl text-sm font-medium transition-all duration-150
                  ${gender === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {gender === 'female' && (
          <div>
            <p className="text-sm font-medium text-slate-500 mb-2">Menstruating status</p>
            <div className="flex gap-2">
              {MENSTRUATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onMenstruatingStatusChange(menstruatingStatus === opt.value ? null : opt.value)}
                  className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all duration-150
                    ${menstruatingStatus === opt.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-blue-300'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <NumericInput label="Age" value={age} onChange={onAgeChange} step={1} min={0} max={120} unit="yrs" />

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-500">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="e.g. Mumbai"
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50
              text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:border-transparent placeholder:text-slate-300"
          />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </SectionCard>
  )
}
