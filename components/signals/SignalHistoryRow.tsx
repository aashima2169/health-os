// components/signals/SignalHistoryRow.tsx
// Compact, mostly-read-only row for the history view — not the full
// interactive SignalCard (its resolve/dismiss buttons and contributing-
// factors detail panel are too heavy for a scannable list of everything
// Signals has ever found). Resolved/dismissed rows get a Reopen action.
'use client'

import { Signal, SignalStatus } from '../../types/signals'

const STATUS_INFO: Record<SignalStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-intelligence-soft text-intelligence' },
  needs_more_data: { label: 'Needs more data', className: 'bg-caution-soft text-caution' },
  resolved: { label: 'Confirmed', className: 'bg-primary-soft text-primary' },
  dismissed: { label: 'Dismissed', className: 'bg-surface-alt text-ink-soft' },
}

function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
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
    <div className="bg-surface rounded-2xl border border-line shadow-sm px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink flex-1 leading-5">
          <BoldText text={signal.title} />
        </p>
        <span className={`text-[10px] font-semibold rounded-full px-2 py-1 flex-shrink-0 ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      </div>
      <p className="text-xs text-ink-faint mt-1.5">
        {signal.confidence}% confidence · {new Date(signal.first_generated_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </p>
      {canReopen && (
        <button
          type="button"
          onClick={() => onReopen(signal.id)}
          disabled={busy}
          className="mt-2 text-xs font-semibold text-intelligence disabled:opacity-50"
        >
          Reopen
        </button>
      )}
    </div>
  )
}
