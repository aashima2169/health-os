// components/shared/SectionCard.tsx
'use client'

import { useState, ReactNode } from 'react'

interface SectionCardProps {
  title: string
  titleEmoji?: string
  subtitle?: string
  microcopy?: string
  completed?: boolean
  defaultOpen?: boolean
  children: ReactNode
}

export default function SectionCard({
  title,
  titleEmoji,
  subtitle,
  microcopy,
  completed = false,
  defaultOpen = false,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`
      bg-white rounded-2xl shadow-sm border transition-all duration-200
      ${completed ? 'border-blue-100' : 'border-slate-100'}
    `}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {/* Completion indicator */}
          <span className={`
            w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all
            ${completed ? 'bg-blue-600' : 'border-2 border-slate-200'}
          `}>
            {completed && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>

          <div>
            <p className="font-semibold text-slate-900 text-[15px] flex items-center gap-1.5 leading-6">
              {titleEmoji && <span className="text-base leading-6">{titleEmoji}</span>}
              <span>{title}</span>
            </p>
            {!open && subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
            {!open && completed && microcopy && (
              <p className="text-xs text-blue-500 mt-0.5 font-medium">{microcopy}</p>
            )}
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0
            ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          <div className="w-full h-px bg-slate-100 mb-4" />
          {children}
        </div>
      )}
    </div>
  )
}