// components/shared/Toggle.tsx
'use client'

interface ToggleProps {
  label: string
  emoji?: string
  description?: string
  checked: boolean
  onChange: (val: boolean) => void
}

export default function Toggle({ label, emoji, description, checked, onChange }: ToggleProps) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-2.5">
      <div className="flex items-start gap-2.5 text-left">
        {emoji && (
          <span className="text-base leading-6 flex-shrink-0 w-5 text-center">{emoji}</span>
        )}
        <div>
          <span className="text-[15px] text-slate-800 leading-6">{label}</span>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200
        ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
          transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  )
}