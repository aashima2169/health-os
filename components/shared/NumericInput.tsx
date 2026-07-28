// components/shared/NumericInput.tsx
'use client'

interface NumericInputProps {
  label: string
  value: number | ''
  onChange: (val: number | '') => void
  placeholder?: string
  step?: number
  min?: number
  max?: number
  unit?: string
}

export default function NumericInput({
  label, value, onChange, placeholder = '0', step = 0.1, min = 0, max, unit,
}: NumericInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink-soft">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
          placeholder={placeholder} step={step} min={min} max={max}
          className="w-full h-12 px-4 rounded-xl border border-line bg-surface-alt
            text-ink text-lg font-medium focus:outline-none focus:ring-2
            focus:ring-primary focus:border-transparent placeholder:text-ink-faint"
        />
        {unit && <span className="text-ink-faint text-sm font-medium w-8 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}