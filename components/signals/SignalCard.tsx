// components/signals/SignalCard.tsx
// One persistent hypothesis. Never renders internal reasoning-module
// terminology — source_specialists/specialists_involved (short internal
// codes like "A3a") are only ever translated through DOMAIN_LABELS below,
// never shown verbatim.
'use client'

import SectionCard from '../shared/SectionCard'
import { Signal } from '../../types/signals'

const DOMAIN_LABELS: Record<string, string> = {
  A1: 'Blood markers',
  A3a: 'General health',
  A3b: 'Skin',
  A3c: 'Mood & stress',
  A3d: 'Gut',
  A3e: 'Energy patterns',
  A3f: 'Nutrition',
}

function domainLabel(code: string): string {
  return DOMAIN_LABELS[code] ?? code
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

const TREND_ICON: Record<string, string> = {
  increasing: '↑',
  decreasing: '↓',
  stable: '→',
  new: '✦',
}

interface SignalCardProps {
  signal: Signal
  onStatusChange: (id: string, status: 'resolved' | 'dismissed') => void
  busy?: boolean
}

export default function SignalCard({ signal, onStatusChange, busy }: SignalCardProps) {
  const trendIcon = signal.confidence_trend ? TREND_ICON[signal.confidence_trend] : null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-semibold text-slate-900 text-[15px] leading-6 flex-1">
          <BoldText text={signal.title} />
        </p>
        <div className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full px-2.5 py-1">
          {signal.confidence}%
          {trendIcon && <span className="text-slate-400">{trendIcon}</span>}
        </div>
      </div>

      <p className="text-sm text-slate-600 leading-5 mb-3">
        <BoldText text={signal.hypothesis} />
      </p>

      {signal.status === 'needs_more_data' && (
        <p className="text-xs text-amber-600 font-medium mb-3">Still gathering enough data to say more.</p>
      )}

      {signal.possible_explanations.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Possible explanations</p>
          <div className="space-y-2">
            {signal.possible_explanations.map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-300 text-sm leading-5">•</span>
                <p className="text-sm text-slate-600 leading-5">
                  <span className="font-medium text-slate-800">{e.explanation}</span>
                  {e.note && <span className="text-slate-500"> — {e.note}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {signal.suggested_experiment && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-3">
          <p className="text-xs font-semibold text-emerald-700 mb-1">🧪 Something to try</p>
          <p className="text-sm text-emerald-900 leading-5">{signal.suggested_experiment}</p>
        </div>
      )}

      <SectionCard
        title="Why this might be happening"
        subtitle={`${signal.contributing_factors.length} data point${signal.contributing_factors.length === 1 ? '' : 's'}`}
      >
        <div className="space-y-3">
          {signal.contributing_factors.map((f, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-slate-800">{f.factor}</p>
              <p className="text-xs text-slate-500 mt-0.5">{f.evidence_summary}</p>
              {f.source_specialists?.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {f.source_specialists.map((code) => (
                    <span key={code} className="text-[10px] text-slate-400 bg-slate-50 rounded px-1.5 py-0.5">
                      {domainLabel(code)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {signal.contradictions.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">What doesn&apos;t fully fit</p>
              {signal.contradictions.map((c, i) => (
                <p key={i} className="text-xs text-slate-500 mb-1">{c.description}</p>
              ))}
            </div>
          )}

          {signal.missing_information.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">What would help clarify this</p>
              {signal.missing_information.map((m, i) => (
                <p key={i} className="text-xs text-slate-500 mb-1">{m.what} — {m.why_it_would_help}</p>
              ))}
            </div>
          )}

          {signal.confidence_history.length > 1 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Confidence over time</p>
              <p className="text-xs text-slate-500">
                {signal.confidence_history.map((h) => `${h.confidence}%`).join(' → ')}
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onStatusChange(signal.id, 'resolved')}
          disabled={busy}
          className="flex-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl py-2.5 disabled:opacity-50"
        >
          I understand this now
        </button>
        <button
          onClick={() => onStatusChange(signal.id, 'dismissed')}
          disabled={busy}
          className="flex-1 text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl py-2.5 disabled:opacity-50"
        >
          Not relevant
        </button>
      </div>
    </div>
  )
}
