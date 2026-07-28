// components/shared/Card.tsx
// The base surface every page should use instead of hand-rolling
// `bg-white rounded-2xl border ...` inline. `tone` gives a section a
// semantic identity — most content stays `default` (your own logged
// data); `intelligence` marks anything AI-generated so it's visually
// distinct from what you logged, not just hedged in copy; `caution` and
// `flare` are reserved for their specific meanings (see globals.css) and
// shouldn't be reached for as generic "warning" colors.
import { ReactNode } from 'react'

export type CardTone = 'default' | 'intelligence' | 'caution' | 'flare'

const TONE_STYLES: Record<CardTone, string> = {
  default: 'bg-surface border-line',
  intelligence: 'bg-intelligence-soft border-intelligence/20',
  caution: 'bg-caution-soft border-caution/20',
  flare: 'bg-flare-soft border-flare/20',
}

interface CardProps {
  children: ReactNode
  tone?: CardTone
  onClick?: () => void
  className?: string
}

export default function Card({ children, tone = 'default', onClick, className = '' }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border px-5 py-4 ${TONE_STYLES[tone]} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
