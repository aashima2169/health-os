// components/shared/SeveritySlider.tsx
'use client'

const LABELS = ['', 'Mild', 'Low', 'Moderate', 'High', 'Severe']
const COLORS = ['', 'bg-green-400', 'bg-lime-400', 'bg-yellow-400', 'bg-orange-400', 'bg-flare-soft0']

interface SeveritySliderProps {
  label?: string
  value: number | null
  onChange: (val: number) => void
}

export default function SeveritySlider({
  label = 'Severity', value, onChange,
}: SeveritySliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        {value && (
          <span className="text-xs font-semibold text-ink-soft">
            {LABELS[value]}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-8 rounded-lg transition-all duration-150
              ${value === n
                ? `${COLORS[n]} shadow-sm`
                : value && value > n
                  ? `${COLORS[n]} opacity-60`
                  : 'bg-surface-alt hover:bg-line'
              }`}
          >
            <span className="sr-only">{LABELS[n]}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-ink-faint">Mild</span>
        <span className="text-[10px] text-ink-faint">Severe</span>
      </div>
    </div>
  )
}