// components/shared/Tag.tsx
// Small pill/badge, replacing the ad-hoc `bg-X-50 text-X-600 rounded-full`
// pattern scattered across pages with one component driven by a semantic
// tone, so the same meaning always gets the same color.
import { ReactNode } from 'react'

export type TagTone = 'data' | 'intelligence' | 'caution' | 'flare' | 'neutral'

const TONE_STYLES: Record<TagTone, string> = {
  data: 'bg-primary-soft text-primary',
  intelligence: 'bg-intelligence-soft text-intelligence',
  caution: 'bg-caution-soft text-caution',
  flare: 'bg-flare-soft text-flare',
  neutral: 'bg-surface-alt text-ink-soft',
}

interface TagProps {
  children: ReactNode
  tone?: TagTone
  className?: string
}

export default function Tag({ children, tone = 'neutral', className = '' }: TagProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TONE_STYLES[tone]} ${className}`}>
      {children}
    </span>
  )
}
