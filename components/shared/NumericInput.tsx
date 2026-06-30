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
      <label className="text-sm font-medium text-slate-500">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
          placeholder={placeholder} step={step} min={min} max={max}
          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50
            text-slate-900 text-lg font-medium focus:outline-none focus:ring-2
            focus:ring-blue-500 focus:border-transparent placeholder:text-slate-300"
        />
        {unit && <span className="text-slate-400 text-sm font-medium w-8 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}