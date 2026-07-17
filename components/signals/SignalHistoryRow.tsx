// components/signals/SignalHistoryRow.tsx
// Compact, mostly-read-only row for the history view — not the full
// interactive SignalCard (its resolve/dismiss buttons and contributing-
// factors detail panel are too heavy for a scannable list of everything
// Signals has ever found). Resolved/dismissed rows get a Reopen action.
'use client'

import { Signal, SignalStatus } from '../../types/signals'

const STATUS_INFO: Record<SignalStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-blue-50 text-blue-600' },
  needs_more_data: { label: 'Needs more data', className: 'bg-amber-50 text-amber-600' },
  resolved: { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-600' },
  dismissed: { label: 'Dismissed', className: 'bg-slate-100 text-slate-500' },
}

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

interface SignalHistoryRowProps {
  signal: Signal
  onReopen: (id: string) => void
  busy?: boolean
}

export default function SignalHistoryRow({ signal, onReopen, busy }: SignalHistoryRowProps) {
  const statusInfo = STATUS_INFO[signal.status]
  const canReopen = signal.status === 'resolved' || signal.status === 'dismissed'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-800 flex-1 leading-5">
          <BoldText text={signal.title} />
        </p>
        <span className={`text-[10px] font-semibold rounded-full px-2 py-1 flex-shrink-0 ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">
        {signal.confidence}% confidence · {new Date(signal.first_generated_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </p>
      {canReopen && (
        <button
          type="button"
          onClick={() => onReopen(signal.id)}
          disabled={busy}
          className="mt-2 text-xs font-semibold text-blue-600 disabled:opacity-50"
        >
          Reopen
        </button>
      )}
    </div>
  )
}
