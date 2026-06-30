// components/today/ReflectionSection.tsx
'use client'

import SectionCard from '../shared/SectionCard'

interface ReflectionSectionProps {
  reflection: string
  onChange: (v: string) => void
}

const PROMPTS = [
  'One thing I noticed about my body today…',
  'What felt different today compared to yesterday?',
  'Something I want to remember about today…',
  'How my body showed up for me today…',
]

export default function ReflectionSection({ reflection, onChange }: ReflectionSectionProps) {
  const completed = reflection.trim().length > 0
  const prompt = PROMPTS[new Date().getDay() % PROMPTS.length]

  return (
    <SectionCard
      title="Reflection"
      titleEmoji="✍️"
      subtitle={completed ? reflection.slice(0, 50) + (reflection.length > 50 ? '…' : '') : 'One line — anything on your mind'}
      completed={completed}
      microcopy="You've got this."
    >
      <p className="text-xs text-slate-400 mb-3">{prompt}</p>
      <textarea
        value={reflection}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Optional — one sentence is enough"
        rows={3}
        maxLength={280}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
          text-sm text-slate-900 placeholder:text-slate-300 resize-none
          focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {reflection.length > 0 && (
        <p className="text-[10px] text-slate-300 text-right mt-1">
          {reflection.length}/280
        </p>
      )}
    </SectionCard>
  )
}