// components/shared/EnergyPicker.tsx
'use client'

const LEVELS = [
  { value: 1, emoji: '😴', label: 'Drained' },
  { value: 2, emoji: '😔', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '⚡', label: 'High' },
]

interface EnergyPickerProps {
  value: number | null
  onChange: (val: number) => void
}

export default function EnergyPicker({ value, onChange }: EnergyPickerProps) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500 mb-3">Energy level</p>
      <div className="flex gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            onClick={() => onChange(l.value)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl
              border transition-all duration-150
              ${value === l.value
                ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200'
                : 'bg-slate-50 border-slate-200 hover:border-blue-300'
              }`}
          >
            <span className="text-xl">{l.emoji}</span>
            <span className={`text-[10px] font-semibold
              ${value === l.value ? 'text-white' : 'text-slate-500'}`}>
              {l.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}