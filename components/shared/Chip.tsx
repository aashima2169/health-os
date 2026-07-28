// components/shared/Chip.tsx
'use client'

interface ChipProps {
  label: string
  selected: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}

export default function Chip({ label, selected, onToggle, size = 'md' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`
        rounded-full font-medium transition-all duration-150 select-none
        ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
        ${selected
          ? 'bg-primary text-white shadow-sm shadow-primary/25'
          : 'bg-surface text-ink border border-line hover:border-primary/50 hover:text-primary'
        }
      `}
    >
      {label}
    </button>
  )
}